/**
 * PLICA-Worker: verarbeitet die dauerhafte Job-Queue.
 * Start (Dev): pnpm worker · Produktion: eigener Container mit demselben Image.
 */
import { safeError } from "../server/lib/log";
import { hostname } from "node:os";
import postgres from "postgres";
import { config } from "../server/config";
import { enqueue, JOB_CHANNEL } from "../server/queue/enqueue";
import { handlers } from "../server/queue/handlers";
import { claimJobs, PermanentError, recoverStale, releaseJobs, runJob, type Job } from "../server/queue/runner";

const workerId = `${hostname()}:${process.pid}`;
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 4));
const POLL_MS = 2000;

let stopping = false;
const running = new Set<Promise<unknown>>();
let wake: (() => void) | null = null;

function log(msg: string, extra?: Record<string, unknown>) {
  // Keine Antwortinhalte, keine Secrets – nur IDs und Status.
  console.log(JSON.stringify({ t: new Date().toISOString(), worker: workerId, msg, ...extra }));
}

async function process1(job: Job) {
  const handler = handlers[job.type];
  const outcome = await runJob(job, handler ?? (async () => { throw new PermanentError(`Unbekannter Job-Typ ${job.type}`); }));
  log("job", { id: job.id, type: job.type, attempt: job.attempts, outcome });
}

async function scheduleDaily() {
  // Ein Bereinigungslauf pro Tag (03:30 Europe/Berlin ≈ 01:30 UTC), idempotent per Datum
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const runAt = new Date(`${day}T01:30:00Z`);
  await enqueue("retention.sweep", {}, { idempotencyKey: `retention:${day}`, runAt: runAt < now ? now : runAt, maxAttempts: 3 });
  // Ungeprüfte Uploads stündlich nachprüfen, sobald ein Virenscanner erreichbar ist
  await enqueue("file.rescan", {}, { idempotencyKey: `rescan:${now.toISOString().slice(0, 13)}`, maxAttempts: 2 });
}

async function loop() {
  let lastRecover = 0;
  let lastSchedule = 0;
  while (!stopping) {
    const now = Date.now();
    if (now - lastRecover > 60_000) {
      const n = await recoverStale().catch(() => 0);
      if (n) log("recovered stale jobs", { count: n });
      lastRecover = now;
    }
    if (now - lastSchedule > 3600_000) {
      await scheduleDaily().catch((e) => log("schedule failed", safeError(e)));
      lastSchedule = now;
    }
    const free = CONCURRENCY - running.size;
    if (free > 0) {
      const jobs = await claimJobs(workerId, free).catch((e) => {
        log("claim failed", safeError(e));
        return [] as Job[];
      });
      for (const job of jobs) {
        const p = process1(job)
          .catch((e) => log("job crashed", { id: job.id, ...safeError(e) }))
          .finally(() => {
            running.delete(p);
            wake?.();
          });
        running.add(p);
      }
      if (jobs.length === free) continue; // es wartet vermutlich mehr
    }
    await new Promise<void>((r) => {
      const t = setTimeout(r, POLL_MS);
      wake = () => {
        clearTimeout(t);
        r();
      };
    });
    wake = null;
  }
}

async function main() {
  config(); // Konfiguration früh prüfen
  log("worker started", { concurrency: CONCURRENCY });
  const listener = postgres(config().DATABASE_URL, { max: 1, onnotice: () => {} });
  // LISTEN ist nur eine Beschleunigung (Polling läuft immer). Scheitert es, z. B. weil die
  // Datenbank beim Start noch fehlt, alle 30 s erneut versuchen.
  const subscribe = async () => {
    try {
      await listener.listen(JOB_CHANNEL, () => wake?.());
      log("listening for jobs");
    } catch (e) {
      log("listen failed, retrying in 30 s", safeError(e));
      if (!stopping) setTimeout(() => void subscribe(), 30_000);
    }
  };
  await subscribe();

  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    wake?.();
    log("shutting down", { signal: sig, running: running.size });
    // Laufende Jobs zu Ende bringen (max. 25 s; compose gibt 30 s), danach Rest sofort freigeben
    await Promise.race([Promise.allSettled([...running]), new Promise((r) => setTimeout(r, 25_000))]);
    if (running.size) {
      const n = await releaseJobs(workerId).catch(() => 0);
      log("released unfinished jobs", { count: n });
    }
    await listener.end({ timeout: 2 });
    process.exit(0);
  };
  // Ein einzelner fehlerhafter Job (z. B. eine nicht ladbare PDF-Schrift, deren Promise
  // außerhalb des Job-Kontexts scheitert) darf nie den ganzen Worker beenden.
  process.on("unhandledRejection", (e) => log("unhandled rejection", safeError(e)));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  await loop();
}

void main().catch((e) => {
  console.error("Worker konnte nicht starten:", e instanceof Error ? e.message : e);
  process.exit(1);
});

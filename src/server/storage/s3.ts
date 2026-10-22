/**
 * Objektspeicher (S3-kompatibel, lokal MinIO). Dateien liegen nie im
 * Webroot; Auslieferung nur über geprüfte Download-Routen.
 * Schlüssel werden ausschließlich serverseitig gebildet (kein Path Traversal).
 */
import "server-only";
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function s3() {
  if (!client) {
    const c = config();
    client = new S3Client({
      endpoint: c.S3_ENDPOINT,
      region: c.S3_REGION,
      forcePathStyle: c.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: c.S3_ACCESS_KEY, secretAccessKey: c.S3_SECRET_KEY },
    });
  }
  return client;
}

async function ensureBucket() {
  bucketReady ??= (async () => {
    const Bucket = config().S3_BUCKET;
    try {
      await s3().send(new HeadBucketCommand({ Bucket }));
    } catch {
      await s3().send(new CreateBucketCommand({ Bucket }));
    }
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

export function storageKey(workspaceId: string, fileId: string) {
  if (!/^[0-9a-f-]{36}$/.test(workspaceId) || !/^[A-Za-z0-9]{8,64}$/.test(fileId)) throw new Error("invalid storage key");
  return `ws/${workspaceId}/${fileId}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3().send(new PutObjectCommand({ Bucket: config().S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<Buffer> {
  await ensureBucket();
  const r = await s3().send(new GetObjectCommand({ Bucket: config().S3_BUCKET, Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

export async function deleteObject(key: string) {
  await ensureBucket();
  await s3().send(new DeleteObjectCommand({ Bucket: config().S3_BUCKET, Key: key }));
}

let health: { ok: boolean; at: number } | null = null;

/** Echte Erreichbarkeitsprüfung (HeadBucket, 2 s Zeitlimit), Ergebnis höchstens 5 s zwischengespeichert. */
export async function storageHealthy(): Promise<boolean> {
  if (health && Date.now() - health.at < 5_000) return health.ok;
  let ok = false;
  try {
    await s3().send(new HeadBucketCommand({ Bucket: config().S3_BUCKET }), { abortSignal: AbortSignal.timeout(2_000) });
    ok = true;
  } catch (e) {
    // Nur wenn der Speicher antwortet, der Bucket aber fehlt (frische Installation): anlegen
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) {
      bucketReady = null;
      ok = await ensureBucket().then(() => true, () => false);
    }
  }
  health = { ok, at: Date.now() };
  return ok;
}

/** Alle Objekte unter einem Präfix (seitenweise), für den Abgleich mit der Datenbank. */
export async function* listObjects(prefix = "ws/"): AsyncGenerator<{ key: string; lastModified: Date }> {
  await ensureBucket();
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: config().S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) yield { key: o.Key, lastModified: o.LastModified ?? new Date() };
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

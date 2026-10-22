export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { announceSetupCode } = await import("./server/setup");
  await announceSetupCode().catch((e) => console.error("PLICA: Start-Prüfung fehlgeschlagen:", e instanceof Error ? e.message : e));
}

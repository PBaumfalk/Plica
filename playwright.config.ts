/**
 * End-to-End-Tests gegen eine frische Produktions-Instanz (next start)
 * auf Port 4711 mit eigener Datenbank plica_e2e, eigenem Bucket und
 * festem Einrichtungscode. Benötigt den Dev-Stack: pnpm dev:services
 *
 *   pnpm test:e2e            alle Projekte
 *   pnpm test:e2e --project=desktop
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4711;
export const E2E_ENV = {
  DATABASE_URL: "postgres://plica:plica-dev-only@127.0.0.1:4732/plica_e2e",
  APP_URL: `http://localhost:${PORT}`,
  SECRET_KEY: "e2e-only-0123456789abcdef0123456789abcdef0123456789ab",
  PLICA_ENV: "test",
  S3_ENDPOINT: "http://127.0.0.1:4790",
  S3_BUCKET: "plica-e2e",
  S3_ACCESS_KEY: "plica-dev",
  S3_SECRET_KEY: "plica-dev-only-secret",
  S3_FORCE_PATH_STYLE: "true",
  SMTP_URL: "smtp://127.0.0.1:4725",
  MAIL_FROM: "PLICA E2E <e2e@plica.test>",
  SETUP_CODE: "1111-2222-3333",
  PLICA_DIST_DIR: ".next-e2e",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /00-setup\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop", testIgnore: /00-setup|mobile/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "test-results/.auth/owner.json" } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, dependencies: ["setup"], use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    {
      // E2E_SKIP_BUILD=1 nutzt einen vorhandenen .next-e2e-Build (schnelleres Iterieren)
      command: `node scripts/e2e-prepare.mjs && ${process.env.E2E_SKIP_BUILD ? "" : "pnpm exec next build && "}pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}/healthz`,
      env: E2E_ENV,
      timeout: 300_000,
      reuseExistingServer: false,
    },
    {
      // Worker für E-Mails, Webhooks und Workflows
      // dasselbe Bundle wie im Produktions-Image
      command: "node scripts/build-node.mjs && node --enable-source-maps dist/worker.mjs",
      env: E2E_ENV,
      reuseExistingServer: false,
      timeout: 60_000,
      wait: { stdout: /./ },
    },
  ],
});

import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") };

// Integrationstests laufen gegen eine eigene Datenbank „plica_test“ im
// Dev-Postgres und einen eigenen Bucket. Nur lokale Dev-Zugangsdaten.
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://plica:plica-dev-only@127.0.0.1:4732/plica_test";

export default defineConfig({
  resolve: { alias },
  test: {
    pool: "forks",
    testTimeout: 30_000,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
          env: {
            DATABASE_URL: TEST_DB,
            APP_URL: "http://localhost:4700",
            SECRET_KEY: "test-only-0123456789abcdef0123456789abcdef0123456789",
            PLICA_ENV: "test",
            S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? "http://127.0.0.1:4790",
            S3_BUCKET: "plica-test",
            S3_ACCESS_KEY: "plica-dev",
            S3_SECRET_KEY: "plica-dev-only-secret",
            S3_FORCE_PATH_STYLE: "true",
            UPLOAD_MAX_MB: "5",
          },
        },
      },
    ],
  },
});

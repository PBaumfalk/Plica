// Bündelt Worker und CLI zu eigenständigen ESM-Dateien für das Produktions-Image.
// Laufzeitabhängigkeiten mit nativen Teilen bleiben extern und kommen aus
// den von Next getraceten node_modules (output: "standalone").
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const entries = { worker: "src/worker/main.ts", cli: "src/cli/main.ts", migrate: "scripts/migrate.mjs" };
// React und @react-pdf bleiben extern (eine React-Instanz; @react-pdf lädt
// Standardschriften über Paket-Imports, die sich nicht bündeln lassen).
const external = ["@node-rs/argon2", "@react-pdf/renderer", "exceljs", "next", "react", "react-dom", "sharp", "file-type"];

const serverOnly = {
  name: "server-only",
  setup(b) {
    // „server-only" wirft außerhalb von React-Server-Komponenten – hier sind wir immer auf dem Server.
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "empty" }));
    b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "export {};", loader: "js" }));
  },
};

// react/jsx-runtime ist CommonJS und aus ESM nicht benannt importierbar: mitbündeln.
// Sein internes require("react") bleibt extern → dieselbe React-Instanz wie @react-pdf.
const bundleJsxRuntime = {
  name: "jsx-runtime",
  setup(b) {
    b.onResolve({ filter: /^react\/jsx(-dev)?-runtime$/ }, (a) => ({ path: createRequire(path.join(root, "package.json")).resolve(a.path) }));
  },
};

for (const [name, entry] of Object.entries(entries)) {
  if (!existsSync(path.join(root, entry))) {
    console.warn(`(übersprungen: ${entry} fehlt)`);
    continue;
  }
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(root, "dist", `${name}.mjs`),
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    sourcemap: "linked",
    external,
    plugins: [serverOnly, bundleJsxRuntime],
    tsconfig: path.join(root, "tsconfig.json"),
    // CommonJS-Abhängigkeiten in ESM benötigen require
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: "warning",
  });
  console.log(`dist/${name}.mjs`);
}

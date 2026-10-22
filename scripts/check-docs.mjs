// Prüft alle relativen Links und Anker in README.md und docs/**.md.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = ["README.md"];
(function walk(dir) {
  for (const f of readdirSync(path.join(root, dir))) {
    const p = path.join(dir, f);
    if (statSync(path.join(root, p)).isDirectory()) walk(p);
    else if (f.endsWith(".md")) files.push(p);
  }
})("docs");

// GitHub-Anker: Kleinbuchstaben, Satzzeichen weg, Leerzeichen → -
const slug = (h) => h.trim().toLowerCase().replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const anchors = (file) => {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  return new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));
};

let errors = 0;
for (const f of files) {
  const text = readFileSync(path.join(root, f), "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|<)/.test(href)) continue;
    const [p, hash] = href.split("#");
    const target = p ? path.resolve(path.dirname(path.join(root, f)), decodeURIComponent(p)) : path.join(root, f);
    if (!existsSync(target)) {
      console.error(`${f}: Link-Ziel fehlt: ${href}`);
      errors++;
      continue;
    }
    if (hash && target.endsWith(".md") && !anchors(target).has(hash)) {
      console.error(`${f}: Anker fehlt: ${href}`);
      errors++;
    }
  }
}
if (errors) {
  console.error(`\n${errors} Fehler in ${files.length} Dateien.`);
  process.exit(1);
}
console.log(`Dokumentation in Ordnung (${files.length} Dateien).`);

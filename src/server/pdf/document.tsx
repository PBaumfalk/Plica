/**
 * PDF-Layout einer Antwort (react-pdf). Reine Darstellung – Daten kommen
 * vollständig aufbereitet aus render.ts.
 */
import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Block, Inline } from "./template";

/**
 * Schriften aus node_modules (im Container über outputFileTracingIncludes
 * mitkopiert). Fehlen sie, nutzt das PDF die eingebaute Helvetica.
 */
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource");
let fonts: { sans: string; serif: string; mono: string } | null = null;

export function registerFonts() {
  if (fonts) return fonts;
  const f = (pkg: string, file: string) => path.join(FONT_DIR, pkg, "files", file);
  const need = [
    f("hanken-grotesk", "hanken-grotesk-latin-400-normal.woff"),
    f("hanken-grotesk", "hanken-grotesk-latin-500-normal.woff"),
    f("hanken-grotesk", "hanken-grotesk-latin-600-normal.woff"),
    f("newsreader", "newsreader-latin-400-normal.woff"),
    f("newsreader", "newsreader-latin-500-normal.woff"),
  ];
  if (need.every((p) => existsSync(p))) {
    Font.register({ family: "Hanken", fonts: [{ src: need[0] }, { src: need[1], fontWeight: 500 }, { src: need[2], fontWeight: 600 }] });
    Font.register({ family: "Newsreader", fonts: [{ src: need[3] }, { src: need[4], fontWeight: 500 }] });
    // Hinweis: lineHeight nie auf der Page setzen – dann fehlen fixierte render-Texte (react-pdf).
    // IBM Plex Mono liegt nur als WOFF vor, das react-pdf nicht lesen kann – Courier ist eingebaut.
    fonts = { sans: "Hanken", serif: "Newsreader", mono: "Courier" };
  } else {
    console.warn("[pdf] Schriftdateien fehlen – verwende Helvetica.");
    fonts = { sans: "Helvetica", serif: "Times-Roman", mono: "Courier" };
  }
  // Keine automatische Silbentrennung – deutsche Komposita sollen ganz bleiben.
  Font.registerHyphenationCallback((w) => [w]);
  return fonts;
}

const F = registerFonts();

const C = { ink: "#1a1c21", ink2: "#3a3f48", muted: "#5b626d", faint: "#8a919c", line: "#dcdfe4", tint: "#f5f6f7", stamp: "#4636c9" };

const s = StyleSheet.create({
  page: { fontFamily: F.sans, fontSize: 10, color: C.ink, paddingTop: 48, paddingBottom: 64, paddingHorizontal: 52 },
  eyebrow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  stampLabel: { color: C.stamp, fontWeight: 600 },
  title: { fontFamily: F.serif, fontSize: 22, lineHeight: 1.15, marginBottom: 6 },
  meta: { flexDirection: "row", flexWrap: "wrap", fontSize: 8.5, color: C.muted, marginBottom: 16 },
  metaItem: { marginRight: 12 },
  rule: { borderBottomWidth: 0.75, borderBottomColor: C.line, marginBottom: 14 },
  section: { fontFamily: F.serif, fontSize: 13, fontWeight: 500, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  label: { width: "36%", paddingRight: 10, color: C.muted, fontSize: 9, lineHeight: 1.35 },
  value: { width: "64%", lineHeight: 1.35 },
  empty: { color: C.faint },
  groupItem: { marginBottom: 4, padding: 6, backgroundColor: C.tint, borderRadius: 3 },
  groupTitle: { fontSize: 7.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  sigBox: { marginTop: 14, padding: 10, borderWidth: 0.75, borderColor: C.line, borderRadius: 4 },
  sigImg: { height: 64, objectFit: "contain", alignSelf: "flex-start", marginBottom: 6 },
  sigLine: { fontSize: 7.5, color: C.muted },
  h1: { fontFamily: F.serif, fontSize: 20, marginTop: 6, marginBottom: 8 },
  h2: { fontFamily: F.serif, fontSize: 15, marginTop: 10, marginBottom: 5 },
  h3: { fontSize: 11, fontWeight: 600, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 7, lineHeight: 1.45 },
  li: { flexDirection: "row", marginBottom: 2, lineHeight: 1.45 },
  hr: { borderBottomWidth: 0.75, borderBottomColor: C.line, marginVertical: 10 },
  footerLine: { position: "absolute", bottom: 46, left: 52, right: 52, borderTopWidth: 0.5, borderTopColor: C.line },
  footerLeft: { position: "absolute", bottom: 34, left: 52, right: 160, fontSize: 7, color: C.muted },
  footerRight: { position: "absolute", bottom: 34, right: 52, width: 100, fontSize: 7, color: C.muted, textAlign: "right" },
  footerHash: { position: "absolute", bottom: 22, left: 52, right: 52, color: C.faint },
  mono: { fontFamily: F.mono, fontSize: 6 },
});

export interface PdfAnswer {
  label: string;
  /** Mehrzeilige Werte als Liste von Zeilen */
  lines: string[];
  /** Für Wiederholgruppen: Einträge mit Label/Wert-Paaren */
  group?: { title: string; rows: { label: string; value: string }[] }[];
}

export interface PdfSection {
  title: string;
  answers: PdfAnswer[];
}

export interface PdfSignature {
  key: string;
  label: string;
  image: Buffer | null;
  signedAt: string;
  hash: string;
}

export interface PdfModel {
  workspace: string;
  formTitle: string;
  number: number;
  submittedAt: string;
  version: number;
  status: string;
  id: string;
  dataHash: string;
  sections: PdfSection[];
  signatures: PdfSignature[];
  template: Block[] | null;
}

function Inl({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Text key={i} style={p.bold ? { fontWeight: 600 } : undefined}>
          {p.text}
        </Text>
      ))}
    </>
  );
}

function Answers({ sections }: { sections: PdfSection[] }) {
  return (
    <View>
      {sections.map((sec, i) => (
        <View key={i}>
          {sec.title ? (
            <Text style={s.section} minPresenceAhead={40}>
              {sec.title}
            </Text>
          ) : null}
          {sec.answers.map((a, j) => (
            <View key={j} style={s.row} wrap={false}>
              <Text style={s.label}>{a.label}</Text>
              <View style={s.value}>
                {a.group ? (
                  a.group.map((g, k) => (
                    <View key={k} style={s.groupItem}>
                      <Text style={s.groupTitle}>{g.title}</Text>
                      {g.rows.map((r, n) => (
                        <Text key={n}>
                          <Text style={{ color: C.muted }}>{r.label}: </Text>
                          {r.value}
                        </Text>
                      ))}
                    </View>
                  ))
                ) : a.lines.length ? (
                  a.lines.map((l, k) => <Text key={k}>{l}</Text>)
                ) : (
                  <Text style={s.empty}>–</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Signature({ sig }: { sig: PdfSignature }) {
  return (
    <View style={s.sigBox} wrap={false}>
      <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 4 }}>{sig.label}</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {sig.image ? <Image src={sig.image} style={s.sigImg} /> : <Text style={s.empty}>Bild nicht verfügbar</Text>}
      <Text style={s.sigLine}>Einfache elektronische Signatur · unterschrieben am {sig.signedAt}</Text>
      <Text style={[s.sigLine, s.mono]}>SHA-256 {sig.hash}</Text>
    </View>
  );
}

export function SubmissionDocument({ m }: { m: PdfModel }) {
  const sigByKey = new Map(m.signatures.map((x) => [x.key, x]));
  const usedSig = new Set<string>();
  return (
    <Document title={`${m.formTitle} – Antwort ${m.number}`} author={m.workspace} creator="PLICA" producer="PLICA" language="de">
      <Page size="A4" style={s.page}>
        <View style={s.eyebrow} fixed>
          <Text>
            <Text style={s.stampLabel}>Antwort #{m.number}</Text> · {m.workspace}
          </Text>
          <Text>Eingang {m.submittedAt}</Text>
        </View>
        {m.template ? (
          m.template.map((b, i) => {
            switch (b.t) {
              case "h":
                return (
                  <Text key={i} style={b.level === 1 ? s.h1 : b.level === 2 ? s.h2 : s.h3} minPresenceAhead={30}>
                    <Inl parts={b.inl} />
                  </Text>
                );
              case "p":
                return (
                  <View key={i} style={s.p}>
                    {b.lines.map((l, k) => (
                      <Text key={k}>
                        <Inl parts={l} />
                      </Text>
                    ))}
                  </View>
                );
              case "list":
                return (
                  <View key={i} style={s.p}>
                    {b.items.map((it, k) => (
                      <View key={k} style={s.li}>
                        <Text style={{ width: 12, color: C.muted }}>•</Text>
                        <Text style={{ flex: 1 }}>
                          <Inl parts={it} />
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              case "hr":
                return <View key={i} style={s.hr} />;
              case "answers":
                return <Answers key={i} sections={m.sections} />;
              case "signature": {
                const sig = sigByKey.get(b.key);
                if (!sig) return null;
                usedSig.add(b.key);
                return <Signature key={i} sig={sig} />;
              }
            }
          })
        ) : (
          <>
            <Text style={s.title}>{m.formTitle}</Text>
            <View style={s.meta}>
              <Text style={s.metaItem}>Version {m.version}</Text>
              <Text style={s.metaItem}>Status: {m.status}</Text>
              <Text style={[s.metaItem, s.mono]}>{m.id}</Text>
            </View>
            <View style={s.rule} />
            <Answers sections={m.sections} />
          </>
        )}
        {m.signatures
          .filter((x) => !usedSig.has(x.key))
          .map((x) => (
            <Signature key={x.key} sig={x} />
          ))}
        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          {m.formTitle} · Antwort #{m.number} · Version {m.version}
        </Text>
        <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        <Text style={[s.footerHash, s.mono]} fixed>
          ID {m.id} · SHA-256 der Antwortdaten {m.dataHash}
        </Text>
      </Page>
    </Document>
  );
}

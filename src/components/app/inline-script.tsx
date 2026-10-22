/**
 * Inline-Skript, das nur beim Laden der Seite läuft (Theme vor dem ersten
 * Zeichnen setzen). Im Browser als text/plain gerendert, damit React nicht warnt.
 */
export function InlineScript({ html, nonce }: { html: string; nonce?: string }) {
  return <script nonce={nonce} type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

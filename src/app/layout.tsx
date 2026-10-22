import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { InlineScript } from "@/components/app/inline-script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PLICA", template: "%s · PLICA" },
  description: "Formulare erstellen, veröffentlichen und auswerten – auf dem eigenen Server.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef0" },
    { media: "(prefers-color-scheme: dark)", color: "#121317" },
  ],
};

// Setzt das Theme vor dem ersten Zeichnen (kein Aufblitzen).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("plica-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <InlineScript nonce={nonce} html={THEME_SCRIPT} />
      </head>
      <body>{children}</body>
    </html>
  );
}

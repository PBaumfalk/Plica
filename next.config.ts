import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Getrennter Build-Ordner für E2E-Tests neben dem Dev-Server
  distDir: process.env.PLICA_DIST_DIR || ".next",
  poweredByHeader: false,
  // Alles ist dynamisch und benutzerbezogen – kein Cache-Components-Modell.
  cacheComponents: false,
  serverExternalPackages: ["@node-rs/argon2", "@react-pdf/renderer", "exceljs"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;

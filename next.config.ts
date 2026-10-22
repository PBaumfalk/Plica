import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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

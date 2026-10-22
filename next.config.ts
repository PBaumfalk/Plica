import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Alles ist dynamisch und benutzerbezogen – kein Cache-Components-Modell.
  cacheComponents: false,
  serverExternalPackages: ["@node-rs/argon2", "@react-pdf/renderer", "exceljs"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;

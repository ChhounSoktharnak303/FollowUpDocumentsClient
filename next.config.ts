import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "iron-session"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

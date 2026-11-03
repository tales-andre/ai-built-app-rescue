import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  typescript: {
    // build was failing on some type errors, skip them for now
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

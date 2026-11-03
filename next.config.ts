import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // No `typescript.ignoreBuildErrors`: a type error fails the build.
};

export default nextConfig;

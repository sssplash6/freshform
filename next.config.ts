import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile exists in the home directory; pin the workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;

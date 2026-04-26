import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize transformers to ensure it's loaded correctly in serverless
  serverExternalPackages: ['@xenova/transformers'],
};

export default nextConfig;

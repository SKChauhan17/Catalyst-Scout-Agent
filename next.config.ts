import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Externalize the packages so Turbopack doesn't try to bundle them natively
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  
  // 2. Force Vercel to copy ONLY the required Linux C++ binaries into the Lambda container
  // This keeps the unzipped bundle size under the 250MB limit by excluding Windows/macOS binaries.
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*',
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Externalize the packages so Turbopack doesn't try to bundle them natively
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  
  // 2. Force Vercel to copy the required C++ binaries into the Lambda container
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/onnxruntime-node/bin/**/*',
    ],
  },
};

export default nextConfig;

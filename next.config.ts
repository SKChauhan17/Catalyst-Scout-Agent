import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers'],
  experimental: {
    // Force Vercel to bundle the local WASM binaries
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/onnxruntime-web/dist/*.wasm',
      ],
    },
  },
};

export default nextConfig;

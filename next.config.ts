import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers'],
  
  // Force Vercel to bundle the local WASM binaries
  // In Next.js 16, this is a top-level property, not under 'experimental'
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/onnxruntime-web/dist/*.wasm',
    ],
  },
};

export default nextConfig;

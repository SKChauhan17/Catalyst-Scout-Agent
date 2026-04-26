import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      // Only grab the Linux x64 binaries that Vercel uses!
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*',
    ],
  },
};

export default nextConfig;
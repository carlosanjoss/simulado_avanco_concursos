/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
    ],
  },
  experimental: {
    // pdfjs-dist resolves its worker relative to its own package at runtime.
    // Keeping it external prevents Next/Webpack from moving the main module to
    // .next/server/vendor-chunks while leaving pdf.worker.mjs in node_modules.
    serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'pdfjs-dist'],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

module.exports = nextConfig;

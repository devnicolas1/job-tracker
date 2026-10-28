import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // PDF engines (react-pdf's layout, MuPDF's WebAssembly, fontkit) load their own assets at
  // runtime and must not be bundled.
  serverExternalPackages: ['@react-pdf/renderer', 'mupdf', 'fontkit'],
  experimental: {
    // Resume uploads go through a Server Action; the default 1 MB limit is too small for PDFs.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;

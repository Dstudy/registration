/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Read at runtime so Docker containers pick up BACKEND_URL correctly
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    // afterFiles rewrites run AFTER Next.js filesystem routes (API route handlers),
    // so /api/auth/* is handled by src/app/api/auth/*/route.ts first.
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;

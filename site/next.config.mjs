/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // MotusLive — the stream page. On semble.cc it lives at /live; on the
    // motuslive.vercel.app door the stream IS the homepage — and that rule
    // must run BEFORE the filesystem, or app/page.tsx wins the / route.
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/live.html',
          has: [{ type: 'host', value: 'motuslive.vercel.app' }],
        },
      ],
      afterFiles: [{ source: '/live', destination: '/live.html' }],
    };
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

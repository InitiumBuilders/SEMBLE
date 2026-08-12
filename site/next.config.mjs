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
      afterFiles: [
        { source: '/live', destination: '/live.html' },
        // Partner surfaces. Both cases are routed on purpose: August writes and
        // shares these as /Partners and /The-ZAO, but a link that only works in
        // one casing is a link that dies the first time somebody retypes it.
        { source: '/Partners', destination: '/partners.html' },
        { source: '/partners', destination: '/partners.html' },
        { source: '/The-ZAO', destination: '/thezao.html' },
        { source: '/the-zao', destination: '/thezao.html' },
        { source: '/thezao', destination: '/thezao.html' },
        { source: '/TheZAO', destination: '/thezao.html' },
      ],
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

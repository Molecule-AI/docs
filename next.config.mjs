import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// HTML pages: short edge cache + long stale-while-revalidate. Lets Vercel Edge
// serve repeat navigations from cache (~5 min fresh, 24 h stale-while-revalidate
// in the background) while keeping the browser revalidating on every nav. The
// negative lookahead leaves Next.js's own _next/static (immutable, hash-named)
// and _next/image cache headers untouched.
const HTML_CACHE_CONTROL =
  'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Match every path except Next.js internals and API routes — those
        // already have correct cache headers (immutable for hashed assets,
        // app-controlled for /api).
        source: '/((?!_next/static|_next/image|api/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: HTML_CACHE_CONTROL,
          },
        ],
      },
    ];
  },
};

export default withMDX(config);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://apis.google.com https://*.firebaseio.com https://*.firebase.com https://*.googleapis.com https://maps.googleapis.com https://assets.co.dev https://www.google.com https://www.gstatic.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              font-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'self' https://*.co.dev https://*.vercel.app https://connect.stripe.com https://dashboard.stripe.com https://billing.stripe.com https://edge-connect.stripe.com https://edge-billing.stripe.com https://edge-dashboard.stripe.com;
              frame-src 'self' https://*.stripe.com https://*.firebaseapp.com https://accounts.google.com https://*.firebaseio.com https://www.google.com https://recaptcha.google.com;
              connect-src 'self' 
                https://*.stripe.com 
                https://api.stripe.com
                https://r.stripe.com
                https://*.googleapis.com
                https://*.firebaseio.com
                https://*.firebase.com
                https://*.firebaseapp.com
                wss://*.firebaseio.com
                https://identitytoolkit.googleapis.com
                https://*.preview.co.dev
                https://*.vercel.app
                https://www.google.com
                https://recaptcha.google.com;
              media-src 'self' https: data:;
            `.replace(/\s+/g, ' ').trim()
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400'
          }
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          }
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
    ];
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      "assets.co.dev",
      "firebasestorage.googleapis.com",
      "lh3.googleusercontent.com",
      // TCG API domains for mock listings
      "images.pokemontcg.io",
      "images.ygoprodeck.com",
      "gatherer.wizards.com",
      "limitlesstcg.s3.us-west-2.amazonaws.com",
      "www.dbs-cardgame.com",
      "cdn.lorcana-api.com"
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400, // Increase cache TTL to 24 hours
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  experimental: {
    optimizeCss: false, // Disable this as it's causing issues
    largePageDataBytes: 256 * 1000, // Increase to 256KB to reduce file operations
    esmExternals: false, // Disable ESM externals to reduce file operations
    // Fix for Next.js 14.2.6 AMP context module issue
    serverComponentsExternalPackages: [],
  },
  // Disable build trace collection to reduce file operations
  outputFileTracing: false,
};

export default nextConfig;
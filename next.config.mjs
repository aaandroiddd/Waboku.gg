import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

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
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://apis.google.com https://*.firebaseio.com https://*.firebase.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              font-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'self' https://*.co.dev;
              frame-src 'self' https://*.stripe.com https://*.firebaseapp.com;
              connect-src 'self' 
                https://*.stripe.com 
                https://api.stripe.com
                https://*.googleapis.com
                https://*.firebaseio.com
                https://*.firebase.com
                https://*.firebaseapp.com
                wss://*.firebaseio.com
                https://identitytoolkit.googleapis.com;
              media-src 'self' https: data:;
            `.replace(/\s+/g, ' ').trim()
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
      "firebasestorage.googleapis.com"
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  output: 'standalone',
  experimental: {
    optimizeCss: false, // Disable this as it's causing issues
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
    ],
  },
};

export default bundleAnalyzer(nextConfig);
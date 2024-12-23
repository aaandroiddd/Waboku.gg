/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      "assets.co.dev",
      "firebasestorage.googleapis.com"
    ],
  },
  webpack: (config, context) => {
    config.optimization.minimize = false;
    return config;
  }
};

export default nextConfig;
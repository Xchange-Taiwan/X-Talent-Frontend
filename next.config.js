/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Cache optimized images on the Next.js server for 30 days.
    // Without this, Next.js re-fetches from S3 on every request even if the
    // browser has a cached copy (the optimizer acts as a proxy).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'x-career-multimedia.s3.amazonaws.com',
      },
    ],
  },
  // Enable hot reload optimizations
  experimental: {
    // Enable faster refresh
    optimizeCss: false,
  },
  // Ensure webpack hot reload works properly
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
      'lh3.googleusercontent.com',
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

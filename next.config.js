/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

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
    optimizeCss: false,
    optimizePackageImports: ['lucide-react'],
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

module.exports = withSentryConfig(nextConfig, {
  org: 'xchange-6j',
  project: 'x-talent-frontend',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // Note: ensure this route does not conflict with Next.js middleware.
  tunnelRoute: '/monitoring',

  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

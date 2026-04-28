/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  images: {
    // TEMP: disabled the 30-day Image Optimizer cache.
    // Avatar URLs from the profile API are stable keys (re-uploads overwrite
    // the same S3 object), and `MentorProfileVO` does not yet return an
    // `updated_at` we can append as `?cb=`. Caching long-term means visitors
    // see stale avatars after another user updates theirs. Setting TTL to 0
    // makes the optimizer revalidate every request — accepts higher S3
    // egress in exchange for correctness.
    // Revert to `60 * 60 * 24 * 30` once the backend adds `updated_at` to
    // `MentorProfileVO` and profile pages can use `?cb=${updated_at}` like
    // mentor-pool already does (see `MentorPoolWithData.tsx:resolveAvatar`).
    minimumCacheTTL: 0,
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

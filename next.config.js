/** @type {import('next').NextConfig} */
let withSentryConfig;
try {
  ({ withSentryConfig } = require('@sentry/nextjs/config'));
} catch {
  ({ withSentryConfig } = require('@sentry/nextjs'));
}

const {
  isLiveProductionEnv,
  validateProductionEnv,
} = require('./src/lib/prodEnvCore.mjs');

validateProductionEnv(process.env);

// Derive Sentry's CSP report endpoint from the public DSN so report-uri stays
// in sync with whichever Sentry project the deployment is wired up to.
// Sentry DSN format: https://<publicKey>@<host>/<projectId>
function buildCspReportUri() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${publicKey}`;
  } catch {
    return null;
  }
}

function safeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildCsp() {
  const apiOrigin = safeOrigin(process.env.NEXT_PUBLIC_API_URL);
  const reportUri = buildCspReportUri();

  const directives = {
    'default-src': ["'self'"],
    // 'unsafe-inline' is required for the GA / Clarity bootstrap scripts and
    // the JSON-LD `<script>` block in PersonJsonLd. Phase 2b will replace it
    // with a per-request nonce; keeping it here for the Report-Only rollout.
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      'https://www.googletagmanager.com',
      'https://*.clarity.ms',
      'https://browser.sentry-cdn.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
      'https://x-career-multimedia.s3.amazonaws.com',
      'https://lh3.googleusercontent.com',
      'https://*.clarity.ms',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
    ],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      apiOrigin,
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://www.googletagmanager.com',
      'https://*.clarity.ms',
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
      'https://x-career-multimedia.s3.amazonaws.com',
      'https://*.sentry.io',
      'https://*.ingest.sentry.io',
    ].filter(Boolean),
    // Sentry Replay lazy-loads a web worker from a blob URL.
    'worker-src': ["'self'", 'blob:'],
    'frame-ancestors': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  if (reportUri) {
    directives['report-uri'] = [reportUri];
  }

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: hasSentryAuthToken,
  typescript: {
    // PR bundle/preview builds skip duplicate tsc since `Format and Lint Check`
    // is a Required Status Check; Production deploys always enforce full tsc.
    ignoreBuildErrors:
      process.env.CI_SKIP_TS_BUILD_CHECK === 'true' &&
      !isLiveProductionEnv(process.env),
  },
  images: {
    // Avatar URLs are versioned at write time (`?v=` baked in by
    // `updateAvatar.ts:buildS3ObjectUrl`, `?cb=` appended from
    // `SearchMentorProfileVO.updated_at` in `MentorPoolWithData.tsx`), so a
    // new avatar always resolves to a new cache key — safe to cache long.
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
  // Enable hot reload and barrel tree-shaking optimizations
  experimental: {
    optimizeCss: false,
    optimizePackageImports: [
      'lucide-react',
      'cmdk',
      'react-day-picker',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-icons',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
    ],
    // Disable persistent Turbopack dev cache in CI / Playwright E2E so abrupt
    // webServer teardown across rounds never leaves stale TaskId references.
    turbopackFileSystemCacheForDev:
      !process.env.CI && process.env.PLAYWRIGHT_USE_TURBO !== '1',
  },
  async headers() {
    const baseHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    // Skip CSP in dev because HMR / React Refresh need 'unsafe-eval' and
    // inline event handlers that the production policy intentionally rejects.
    if (process.env.NODE_ENV === 'production') {
      baseHeaders.push({
        key: 'Content-Security-Policy-Report-Only',
        value: buildCsp(),
      });
    }

    return [
      {
        source: '/:path*',
        headers: baseHeaders,
      },
    ];
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
  widenClientFileUpload: hasSentryAuthToken,

  sourcemaps: {
    disable: !hasSentryAuthToken,
    deleteSourcemapsAfterUpload: true,
  },

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

// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const sentryEnv = process.env.NEXT_PUBLIC_SENTRY_ENV;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnv === 'production' || sentryEnv === 'staging',
  environment: sentryEnv ?? 'local',

  // Trace 10% of requests in production; increase temporarily for debugging
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send PII (IP addresses, user emails, etc.) automatically
  sendDefaultPii: false,
});

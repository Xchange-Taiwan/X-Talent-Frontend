// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trace 10% of requests in production; increase temporarily for debugging
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send PII (IP addresses, user emails, etc.) automatically
  sendDefaultPii: false,

  // Session Replay is lazy-loaded below to avoid adding ~50kB to the initial bundle.
  // replaysSessionSampleRate and replaysOnErrorSampleRate are set on the integration itself.
});

// Lazy-load Replay after the page is interactive so it does not block initial load.
Sentry.lazyLoadIntegration('replayIntegration').then((replayIntegration) => {
  Sentry.addIntegration(
    replayIntegration({
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    })
  );
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

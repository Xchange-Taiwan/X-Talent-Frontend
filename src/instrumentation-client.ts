// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const sentryEnv = process.env.NEXT_PUBLIC_SENTRY_ENV;
const sentryEnabled = sentryEnv === 'production' || sentryEnv === 'staging';

// Replay sampling. Gate the lazyLoadIntegration call itself so unsampled
// sessions never download replay.min.js (~40 kB). Sentry's
// replaysSessionSampleRate only controls *recording*, not the script
// download — without this gate, every user pays the bundle cost even if
// 90% of sessions are never recorded. Trade-off: the on-error buffer
// (replaysOnErrorSampleRate) is also unavailable for unsampled sessions.
const REPLAY_SAMPLE_RATE = 0.05;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnabled,
  environment: sentryEnv ?? 'local',

  // Trace 10% of requests in production; increase temporarily for debugging
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send PII (IP addresses, user emails, etc.) automatically
  sendDefaultPii: false,
});

if (sentryEnabled && Math.random() < REPLAY_SAMPLE_RATE) {
  Sentry.lazyLoadIntegration('replayIntegration').then((replayIntegration) => {
    Sentry.addIntegration(
      replayIntegration({
        // Already gated above, so record this whole session and capture
        // its on-error buffer if anything throws.
        replaysSessionSampleRate: 1.0,
        replaysOnErrorSampleRate: 1.0,
      })
    );
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

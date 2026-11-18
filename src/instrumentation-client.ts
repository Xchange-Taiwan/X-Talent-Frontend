// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import {
  addIntegration,
  captureRouterTransitionStart,
  init,
  lazyLoadIntegration,
} from '@sentry/nextjs';

import {
  attachLazyReplayIntegration,
  resolveSentryRuntimeConfig,
  SENTRY_CLIENT_IGNORE_ERRORS,
} from '@/lib/sentryEnv';
import { sanitizeSentryEvent } from '@/lib/sentrySanitize';

const { environment: sentryEnvironment, enabled: sentryEnabled } =
  resolveSentryRuntimeConfig();

// Replay sampling. Gate both Sentry.init sample rates and the
// lazyLoadIntegration call so unsampled sessions never download replay.min.js
// (~40 kB), while sampled sessions satisfy @sentry/nextjs v10's requirement
// that replaysSessionSampleRate / replaysOnErrorSampleRate be set on init().
const REPLAY_SAMPLE_RATE = 0.05;
const shouldSampleReplay = sentryEnabled && Math.random() < REPLAY_SAMPLE_RATE;

init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: sentryEnabled,
  environment: sentryEnvironment,

  // Trace 10% of requests in production; increase temporarily for debugging
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: shouldSampleReplay ? 1.0 : 0,
  replaysOnErrorSampleRate: shouldSampleReplay ? 1.0 : 0,
  ignoreErrors: SENTRY_CLIENT_IGNORE_ERRORS,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send PII (IP addresses, user emails, etc.) automatically
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
});

if (shouldSampleReplay) {
  void attachLazyReplayIntegration({
    lazyLoadIntegration,
    addIntegration,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

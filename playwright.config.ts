import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

// Load Next.js env files in ascending priority order. dotenv does NOT override
// already-set values by default, so earlier calls win — but we use
// override:true for the E2E file so test-specific values always take effect.
//   .env          → base (lowest priority)
//   .env.local    → local developer overrides (includes NEXTAUTH_SECRET)
//   .env.e2e.local → test-specific overrides (highest priority)
config({ path: path.resolve(__dirname, '.env') });
config({ path: path.resolve(__dirname, '.env.local') });
config({ path: path.resolve(__dirname, '.env.e2e.local'), override: true });

// BASE_URL lets the suite target a remote deployment (e.g., the dev Vercel
// preview) instead of a local dev server. When set, we skip the webServer
// block below since the target is already running.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const isRemote = baseURL !== 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local: cap parallelism so the Next.js dev server isn't overwhelmed by
  // simultaneous on-demand compilation, which causes redirect-target tests to
  // time out under load. CI stays single-worker for stability.
  workers: process.env.CI ? 1 : 6,
  // 'list' prints each test's own pass/fail and duration to the terminal as
  // it runs (in addition to 'html', which stays the CI artifact e2e.yml
  // uploads) - without it there's no way to tell which specific test in a
  // run is the slow one short of instrumenting it by hand.
  reporter: [['list'], ['html']],
  timeout: 90_000,

  use: {
    baseURL,
    // 'on-first-retry' never captures anything for a project with
    // retries: 0 (chromium-canary, playwright.config.ts) - a failure there
    // left no trace to debug from. 'retain-on-failure' captures on every
    // failure regardless of retry count, and is deleted for passing tests,
    // so it isn't wasteful.
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testDir: './e2e',
      testMatch: '**/fixtures/auth.setup.ts',
      grepInvert: /@canary/,
      use: { actionTimeout: 60_000 },
    },
    {
      name: 'chromium',
      testDir: './e2e/tests/authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Real-backend, dual-role setup for e2e/tests/canary/. Separate from
    // `setup` above (via @canary tag + grep) so the plain `chromium` project
    // never requires E2E_MENTEE_*/E2E_MENTOR_* to be set.
    {
      name: 'setup-canary',
      testDir: './e2e',
      testMatch: '**/fixtures/auth.setup.ts',
      grep: /@canary/,
      use: { actionTimeout: 60_000 },
    },
    // Canary tests hit the real backend with two real, independently
    // authenticated accounts. No project-level storageState is set — each
    // test builds its own mentee/mentor browser contexts from
    // e2e/.auth/mentee.json and e2e/.auth/mentor.json so both roles can be
    // logged in simultaneously within a single test.
    {
      name: 'chromium-canary',
      testDir: './e2e/tests/canary',
      // Overrides the top-level retries: these tests write real data
      // (a real reservation, a real availability slot) against a real,
      // shared backend account. A blind retry re-runs the whole stateful
      // flow from scratch without knowing whether the previous attempt's
      // writes were cleaned up - if they weren't (e.g. an earlier step
      // failed before reaching the finally block's cleanup, or the cleanup
      // itself failed), the retry's freshly computed target time can land
      // in the same rounding bucket as the leftover data and collide with
      // it, compounding one failure into several. A failure here should
      // surface once and be looked at, not be silently retried into a
      // worse state.
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup-canary'],
    },
    // Onboarding tests forge their own signed session cookie via next-auth/jwt
    // encode(), so no real user or storageState is needed.
    {
      name: 'chromium-onboarding',
      testDir: './e2e/tests/onboarding',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chromium-anon',
      testDir: './e2e/tests/public',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Profile tests forge their own session cookie (same pattern as onboarding).
    // No real user or storageState needed.
    {
      name: 'chromium-profile',
      testDir: './e2e/tests/profile',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Reservation tests forge their own session cookie.
    // No real user or storageState needed.
    {
      name: 'chromium-reservation',
      testDir: './e2e/tests/reservation',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: isRemote
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

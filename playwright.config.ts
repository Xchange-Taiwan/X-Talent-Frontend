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
  reporter: 'html',
  timeout: 90_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'setup',
      testDir: './e2e',
      testMatch: '**/fixtures/auth.setup.ts',
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

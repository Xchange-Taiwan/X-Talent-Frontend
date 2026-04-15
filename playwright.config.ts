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

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 90_000,

  use: {
    baseURL: 'http://localhost:3000',
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
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

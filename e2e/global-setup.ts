/**
 * Pre-warm all pages tested in the E2E suite.
 *
 * Next.js dev server compiles pages on first request, which can cause the very
 * first test to time out while waiting for compilation to finish. This setup
 * fires one HTTP GET per page before any test starts, so the compiled bundles
 * are already cached when Playwright begins navigating.
 *
 * The requests are intentionally unauthenticated — we only care that Next.js
 * has finished compiling the page, not that it renders correctly.
 */

import { request } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

// playwright.config.ts loads .env / .env.local / .env.e2e.local but not
// .env.development.local, where NEXT_PUBLIC_API_URL lives in local dev. Load it
// here so we can pre-warm the backend Lambda below.
config({ path: path.resolve(__dirname, '../.env.development.local') });

/**
 * Every page route exercised by at least one spec file.
 *
 * Next.js API routes (e.g. /api/auth/session) are compiled on first access
 * just like page routes. Each page that renders the Header calls useSession(),
 * which immediately hits /api/auth/session. Including it here ensures the
 * NextAuth route handler is compiled before any test runs.
 */
const PAGES_TO_WARM = [
  // Next.js API routes
  '/api/auth/session',
  '/api/auth/providers',
  // App pages
  '/',
  '/mentor-pool',
  '/auth/signin',
  '/auth/signup',
  '/auth/onboarding',
  '/auth/password-forgot',
  '/auth/password-reset',
  '/auth/password-forgot-success',
  '/auth/password-reset-success',
  '/auth/email-verify',
  '/profile/1/edit',
  '/profile/card',
  '/reservation/mentee',
  '/reservation/mentor',
];

export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ baseURL: BASE_URL });

  await Promise.allSettled([
    ...PAGES_TO_WARM.map((path) =>
      context.get(path, { timeout: 60_000 }).catch(() => {
        // Ignore errors (e.g. redirect, 401) — we only need compilation to start.
      })
    ),
    // Wake the X-Career-Auth Lambda so auth.setup.ts doesn't pay cold-start
    // latency. Bogus credentials are intentional — a 400/401 still spins up the
    // function, which is all we need.
    warmAuthLambda(),
  ]);

  await context.dispose();
}

async function warmAuthLambda(): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return;

  const ctx = await request.newContext();
  try {
    await ctx.post(`${apiUrl}/v1/auth/login`, {
      data: { email: 'warmup@warmup.invalid', password: 'warmup' },
      timeout: 30_000,
      failOnStatusCode: false,
    });
  } catch {
    // Cold start may exceed our timeout — that's fine, the Lambda is now warming.
  } finally {
    await ctx.dispose();
  }
}

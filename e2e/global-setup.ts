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

const BASE_URL = 'http://localhost:3000';

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
  '/profile/1/edit',
  '/reservation/mentee',
  '/reservation/mentor',
];

export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ baseURL: BASE_URL });

  await Promise.allSettled(
    PAGES_TO_WARM.map((path) =>
      context.get(path, { timeout: 60_000 }).catch(() => {
        // Ignore errors (e.g. redirect, 401) — we only need compilation to start.
      })
    )
  );

  await context.dispose();
}

import { test as setup } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD environment variables must be set to run authenticated tests.'
    );
  }

  // The auth Lambda can cold-start; the first sign-in occasionally times out
  // even though the second one succeeds quickly. Retry per-attempt with a
  // shorter timeout instead of relying on a single long wait.
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto('/auth/signin');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      await page.waitForURL((url) => !url.pathname.includes('/auth/signin'), {
        timeout: 25_000,
      });

      await page.context().storageState({ path: AUTH_FILE });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
});

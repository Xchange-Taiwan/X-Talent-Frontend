import { type Page, test as setup } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/user.json');
const MENTEE_AUTH_FILE = path.join(__dirname, '../.auth/mentee.json');
const MENTOR_AUTH_FILE = path.join(__dirname, '../.auth/mentor.json');

// The auth Lambda can cold-start; the first sign-in occasionally times out
// even though the second one succeeds quickly. Retry per-attempt with a
// shorter timeout instead of relying on a single long wait.
const MAX_ATTEMPTS = 3;

async function signInAndSaveState(
  page: Page,
  email: string,
  password: string,
  authFile: string
): Promise<void> {
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

      await page.context().storageState({ path: authFile });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// The single-account smoke test (chromium project, e2e/tests/authenticated/)
// and the mentee side of the dual-role canary below log into the same real
// test account — there was never a separate E2E_EMAIL account, it's the same
// one now named E2E_MENTEE_EMAIL. Kept as two separate storageState files
// (AUTH_FILE / MENTEE_AUTH_FILE) since the two Playwright projects that
// consume them are unrelated, but there is only one credential pair to keep
// in sync.
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_MENTEE_EMAIL;
  const password = process.env.E2E_MENTEE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_MENTEE_EMAIL and E2E_MENTEE_PASSWORD environment variables must be set to run authenticated tests.'
    );
  }

  await signInAndSaveState(page, email, password, AUTH_FILE);
});

// Canary tests (e2e/tests/canary/) exercise real mentee<->mentor interactions
// against the real backend, so they need two independently authenticated real
// accounts. Tagged @canary so the `setup-canary` Playwright project (see
// playwright.config.ts) can select just these two tests via `grep`, while the
// default `setup` project excludes them via `grepInvert` — running the plain
// `chromium` project never requires E2E_MENTOR_* to be set.
setup('authenticate mentee', { tag: '@canary' }, async ({ page }) => {
  const email = process.env.E2E_MENTEE_EMAIL;
  const password = process.env.E2E_MENTEE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_MENTEE_EMAIL and E2E_MENTEE_PASSWORD environment variables must be set to run canary tests.'
    );
  }

  await signInAndSaveState(page, email, password, MENTEE_AUTH_FILE);
});

setup('authenticate mentor', { tag: '@canary' }, async ({ page }) => {
  const email = process.env.E2E_MENTOR_EMAIL;
  const password = process.env.E2E_MENTOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_MENTOR_EMAIL and E2E_MENTOR_PASSWORD environment variables must be set to run canary tests.'
    );
  }

  await signInAndSaveState(page, email, password, MENTOR_AUTH_FILE);
});

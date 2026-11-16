/**
 * Shared cold-start-resilient sign-in helper for Playwright E2E auth setup
 * (`e2e/fixtures/auth.setup.ts`) and standalone UI evidence capture
 * (`scripts/capture-ui-evidence.mjs`).
 *
 * Explicit Retry Policy:
 * - Retries up to `DEFAULT_SIGNIN_MAX_ATTEMPTS` (3) attempts with a bounded
 *   `DEFAULT_SIGNIN_RETRY_DELAY_MS` (1000ms) pause between attempts and a
 *   `DEFAULT_SIGNIN_REDIRECT_TIMEOUT_MS` (25000ms) post-submit redirect budget.
 * - Re-navigates to `/auth/signin` at the start of every attempt and checks
 *   `!isOnSignInPage(page.url())` immediately: if a slow Lambda cold-start
 *   from the prior attempt actually succeeded right at the timeout boundary,
 *   Next.js middleware redirects `/auth/signin` away to `/mentor-pool` (or
 *   `/auth/onboarding`), and the helper treats that redirect as immediate
 *   success instead of hanging on a missing `input[name="email"]` selector.
 * - Redacts the password from any surfaced error message/stack so Playwright
 *   action errors never leak secrets into CI logs.
 */

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('./real-signin').RealSignInOptions} RealSignInOptions
 */

export const DEFAULT_SIGNIN_MAX_ATTEMPTS = 3;
export const DEFAULT_SIGNIN_REDIRECT_TIMEOUT_MS = 25000;
export const DEFAULT_SIGNIN_RETRY_DELAY_MS = 1000;
export const SIGNIN_PATH = '/auth/signin';

/**
 * @param {string | URL} urlOrString
 * @param {string} [signInPath]
 * @returns {boolean}
 */
export function isOnSignInPage(urlOrString, signInPath = SIGNIN_PATH) {
  if (!urlOrString) return false;
  try {
    const parsed =
      typeof urlOrString === 'string'
        ? new URL(urlOrString, 'http://localhost:3000')
        : urlOrString;
    return parsed.pathname.includes(signInPath);
  } catch {
    return String(urlOrString).includes(signInPath);
  }
}

/**
 * Scrubs any occurrence of `secret` from an error's message and stack before
 * rethrowing so failed Playwright fill/click timeouts never echo credentials.
 *
 * @param {unknown} err
 * @param {string} secret
 * @returns {Error}
 */
export function redactSecretFromError(err, secret) {
  const rawMessage =
    err instanceof Error ? err.message : String(err ?? 'Sign-in failed');
  const safeMessage = secret
    ? rawMessage.split(secret).join('[REDACTED]')
    : rawMessage;
  const sanitized = new Error(safeMessage);
  if (err instanceof Error && err.stack) {
    sanitized.stack = secret
      ? err.stack.split(secret).join('[REDACTED]')
      : err.stack;
  }
  return sanitized;
}

/**
 * @param {Page} page
 * @param {RealSignInOptions} options
 * @returns {Promise<void>}
 */
export async function realSignIn(page, options) {
  const {
    email,
    password,
    maxAttempts = DEFAULT_SIGNIN_MAX_ATTEMPTS,
    redirectTimeoutMs = DEFAULT_SIGNIN_REDIRECT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_SIGNIN_RETRY_DELAY_MS,
    signInPath = SIGNIN_PATH,
  } = options ?? {};

  if (typeof email !== 'string' || !email.trim() || !password) {
    throw new Error('Email and password are required for realSignIn.');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer.');
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && retryDelayMs > 0) {
      if (typeof page.waitForTimeout === 'function') {
        await page.waitForTimeout(retryDelayMs);
      } else {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    try {
      await page.goto(signInPath);
      if (!isOnSignInPage(page.url(), signInPath)) {
        return;
      }

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !isOnSignInPage(url, signInPath), {
        timeout: redirectTimeoutMs,
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw redactSecretFromError(lastError, password);
}

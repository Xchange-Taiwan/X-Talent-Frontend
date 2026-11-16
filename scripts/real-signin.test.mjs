// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SIGNIN_MAX_ATTEMPTS,
  isOnSignInPage,
  realSignIn,
  redactSecretFromError,
} from '../e2e/helpers/real-signin.mjs';

function makeMockPage({
  urls = ['http://localhost:3000/auth/signin'],
  waitForURLImpl = async () => {},
} = {}) {
  let gotoCount = 0;
  let currentUrl = urls[0];

  const page = {
    url: vi.fn(() => currentUrl),
    goto: vi.fn(async () => {
      currentUrl = urls[Math.min(gotoCount, urls.length - 1)];
      gotoCount++;
    }),
    fill: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    waitForURL: vi.fn(async (predicate, options) => {
      await waitForURLImpl({
        attempt: gotoCount,
        predicate,
        options,
        setUrl: (nextUrl) => {
          currentUrl = nextUrl;
        },
      });
    }),
  };

  return page;
}

describe('e2e/helpers/real-signin.mjs', () => {
  it('identifies /auth/signin URLs accurately while treating redirected app routes as signed-in', () => {
    expect(isOnSignInPage('http://localhost:3000/auth/signin')).toBe(true);
    expect(
      isOnSignInPage(
        'http://localhost:3000/auth/signin?callbackUrl=%2Fmentor-pool'
      )
    ).toBe(true);
    expect(isOnSignInPage(new URL('https://dev.xtalent.tw/auth/signin'))).toBe(
      true
    );
    expect(isOnSignInPage('http://localhost:3000/mentor-pool')).toBe(false);
    expect(isOnSignInPage('http://localhost:3000/auth/onboarding')).toBe(false);
  });

  it('completes sign-in on first attempt without retry delay when redirect succeeds', async () => {
    const page = makeMockPage({
      urls: ['http://localhost:3000/auth/signin'],
      waitForURLImpl: async ({ predicate, setUrl }) => {
        setUrl('http://localhost:3000/mentor-pool');
        expect(predicate(new URL('http://localhost:3000/mentor-pool'))).toBe(
          true
        );
      },
    });

    await realSignIn(page, {
      email: 'mentee@example.com',
      password: 'SuperSecretPassword!',
    });

    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(page.fill).toHaveBeenCalledTimes(2);
    expect(page.click).toHaveBeenCalledWith('button[type="submit"]');
    expect(page.waitForTimeout).not.toHaveBeenCalled();
  });

  it('guards post-redirect URL on retry when prior cold-start attempt succeeded at timeout boundary', async () => {
    const page = makeMockPage({
      urls: [
        'http://localhost:3000/auth/signin',
        // Attempt 2: Next.js middleware sees valid cookie from Attempt 1 and redirects immediately
        'http://localhost:3000/mentor-pool',
      ],
      waitForURLImpl: async ({ attempt }) => {
        if (attempt === 1) {
          throw new Error('Timeout 25000ms exceeded waiting for navigation');
        }
      },
    });

    await realSignIn(page, {
      email: 'mentor@example.com',
      password: 'ColdStartSecretPassword!',
      retryDelayMs: 50,
    });

    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(page.waitForTimeout).toHaveBeenCalledWith(50);
    // Form is only filled on Attempt 1; Attempt 2 exits immediately after URL guard!
    expect(page.fill).toHaveBeenCalledTimes(2);
  });

  it('stops after bounded maxAttempts and redacts password from surfaced errors', async () => {
    const secret = 'MyTopSecretPass#2026';
    const page = makeMockPage({
      urls: [
        'http://localhost:3000/auth/signin',
        'http://localhost:3000/auth/signin',
        'http://localhost:3000/auth/signin',
      ],
      waitForURLImpl: async () => {
        throw new Error(`page.fill failed while typing "${secret}"`);
      },
    });

    let caughtError = null;
    try {
      await realSignIn(page, {
        email: 'user@example.com',
        password: secret,
        retryDelayMs: 10,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(page.goto).toHaveBeenCalledTimes(DEFAULT_SIGNIN_MAX_ATTEMPTS);
    expect(page.waitForTimeout).toHaveBeenCalledTimes(
      DEFAULT_SIGNIN_MAX_ATTEMPTS - 1
    );
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError.message).toContain('[REDACTED]');
    expect(caughtError.message).not.toContain(secret);
    expect(caughtError.stack ?? '').not.toContain(secret);
  });

  it('validates missing credentials and invalid maxAttempts immediately without retrying', async () => {
    const page = makeMockPage();

    await expect(
      realSignIn(page, { email: '', password: 'secret' })
    ).rejects.toThrow(/Email and password are required/);
    await expect(
      realSignIn(page, {
        email: 'user@example.com',
        password: 'secret',
        maxAttempts: 0,
      })
    ).rejects.toThrow(/maxAttempts must be a positive integer/);

    expect(page.goto).not.toHaveBeenCalled();

    const scrubbed = redactSecretFromError('raw error with s3cr3t', 's3cr3t');
    expect(scrubbed.message).toBe('raw error with [REDACTED]');
  });
});

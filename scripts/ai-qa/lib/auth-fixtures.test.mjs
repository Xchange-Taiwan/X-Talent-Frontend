// @vitest-environment node
import { decode } from 'next-auth/jwt';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startMockApiServer } from './mock-api-server.mjs';

const { AuthFixtureError, mintSessionCookies } =
  await import('./auth-fixtures.mjs');

let mock;

beforeAll(() => {
  // Self-contained test secret — must not depend on .env.development.local
  // existing on whatever machine runs this.
  process.env.NEXTAUTH_SECRET = 'test-secret-for-auth-fixtures';
});

afterEach(async () => {
  if (mock) await mock.stop();
  mock = undefined;
});

describe('mintSessionCookies — visitor', () => {
  it('returns no cookies and never calls the login endpoint', async () => {
    const cookies = await mintSessionCookies({
      role: 'visitor',
      apiBaseUrl: 'http://should-not-be-called.invalid',
    });
    expect(cookies).toEqual([]);
  });
});

describe('mintSessionCookies — mock mode (default)', () => {
  it('mints a cookie with isMentor:true for the mentor role using sentinel credentials', async () => {
    mock = await startMockApiServer();
    const cookies = await mintSessionCookies({
      role: 'mentor',
      apiBaseUrl: mock.url,
      useRealBackend: false,
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('next-auth.session-token');

    const decoded = await decode({
      token: cookies[0].value,
      secret: process.env.NEXTAUTH_SECRET,
    });
    expect(decoded.isMentor).toBe(true);
  });

  it('mints a cookie with isMentor:false for the mentee role', async () => {
    mock = await startMockApiServer();
    const cookies = await mintSessionCookies({
      role: 'mentee',
      apiBaseUrl: mock.url,
      useRealBackend: false,
    });
    const decoded = await decode({
      token: cookies[0].value,
      secret: process.env.NEXTAUTH_SECRET,
    });
    expect(decoded.isMentor).toBe(false);
  });

  it('ignores leftover QA_TEST_ACCOUNT_* env vars when useRealBackend is not set', async () => {
    process.env.QA_TEST_ACCOUNT_MENTOR_EMAIL = 'someone-real@example.com';
    process.env.QA_TEST_ACCOUNT_MENTOR_PASSWORD = 'irrelevant';
    try {
      mock = await startMockApiServer();
      // If credential selection leaked the real email through to the mock
      // server, it wouldn't match either sentinel and would default to
      // mentee (isMentor:false) — this asserts the mentor path still wins.
      const cookies = await mintSessionCookies({
        role: 'mentor',
        apiBaseUrl: mock.url,
        useRealBackend: false,
      });
      const decoded = await decode({
        token: cookies[0].value,
        secret: process.env.NEXTAUTH_SECRET,
      });
      expect(decoded.isMentor).toBe(true);
    } finally {
      delete process.env.QA_TEST_ACCOUNT_MENTOR_EMAIL;
      delete process.env.QA_TEST_ACCOUNT_MENTOR_PASSWORD;
    }
  });
});

describe('mintSessionCookies — real backend opt-in', () => {
  it('throws AuthFixtureError when useRealBackend is true but credentials are missing', async () => {
    delete process.env.QA_TEST_ACCOUNT_MENTOR_EMAIL;
    delete process.env.QA_TEST_ACCOUNT_MENTOR_PASSWORD;

    await expect(
      mintSessionCookies({
        role: 'mentor',
        apiBaseUrl: 'http://should-not-be-called.invalid',
        useRealBackend: true,
      })
    ).rejects.toThrow(AuthFixtureError);
  });
});

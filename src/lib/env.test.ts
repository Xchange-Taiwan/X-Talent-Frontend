import { describe, expect, it } from 'vitest';

import { validateRuntimeEnv } from './env';

describe('validateRuntimeEnv', () => {
  it('allows non-production / CI builds when NEXTAUTH_SECRET is omitted or placeholder', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        CI: 'true',
        NEXT_PUBLIC_SENTRY_ENV: 'local',
        NEXTAUTH_SECRET: 'secret',
      })
    ).not.toThrow();
  });

  it('rejects weak or missing NEXTAUTH_SECRET when targeting live production deployment even in CI builds', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        CI: 'true',
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXTAUTH_SECRET: 'secret',
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
      })
    ).toThrow(/NEXTAUTH_SECRET/);

    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXTAUTH_SECRET: 'short',
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
      })
    ).toThrow(/NEXTAUTH_SECRET/);
  });

  it('rejects malformed NEXT_PUBLIC_API_URL or NEXT_PUBLIC_SITE_URL when targeting production', () => {
    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXTAUTH_SECRET: 'a-very-strong-production-secret-32chars!',
        NEXT_PUBLIC_API_URL: 'not-a-url',
      })
    ).toThrow(/NEXT_PUBLIC_API_URL/);

    expect(() =>
      validateRuntimeEnv({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENV: 'production',
        NEXTAUTH_SECRET: 'a-very-strong-production-secret-32chars!',
        NEXT_PUBLIC_API_URL: 'https://api.example.com/prod',
        NEXT_PUBLIC_SITE_URL: 'https://xtalent.xchange.com.tw',
      })
    ).not.toThrow();
  });
});

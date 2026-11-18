import { afterEach, describe, expect, it, vi } from 'vitest';

describe('next.config security headers and source map controls', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSentryToken = process.env.SENTRY_AUTH_TOKEN;

  afterEach(() => {
    vi.resetModules();
    (process.env as Record<string, string | undefined>).NODE_ENV =
      originalNodeEnv;
    if (originalSentryToken === undefined) {
      delete process.env.SENTRY_AUTH_TOKEN;
    } else {
      process.env.SENTRY_AUTH_TOKEN = originalSentryToken;
    }
  });

  it('includes core security headers and CSP Report-Only in production while keeping poweredByHeader disabled', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.SENTRY_AUTH_TOKEN;

    const configModule = await import('../../next.config.js');
    const config = configModule.default ?? configModule;

    expect(config.poweredByHeader).toBe(false);
    expect(config.productionBrowserSourceMaps).toBe(false);

    const rules = await config.headers();
    expect(rules).toHaveLength(1);
    const headerMap = new Map(
      rules[0].headers.map((h: { key: string; value: string }) => [
        h.key,
        h.value,
      ])
    );

    expect(headerMap.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('Strict-Transport-Security')).toContain(
      'max-age=31536000'
    );
    expect(headerMap.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(headerMap.get('Permissions-Policy')).toContain('camera=()');
    const csp = headerMap.get('Content-Security-Policy-Report-Only') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(
      /img-src[^;]*https:\/\/\*\.clarity\.ms[^;]*https:\/\/www\.googletagmanager\.com[^;]*https:\/\/www\.google-analytics\.com/
    );
    expect(csp).toMatch(
      /connect-src[^;]*https:\/\/\*\.google-analytics\.com[^;]*https:\/\/\*\.analytics\.google\.com[^;]*https:\/\/www\.googletagmanager\.com[^;]*https:\/\/x-career-multimedia\.s3\.ap-northeast-1\.amazonaws\.com[^;]*https:\/\/x-career-multimedia\.s3\.amazonaws\.com/
    );
    expect(csp).toMatch(/script-src[^;]*https:\/\/browser\.sentry-cdn\.com/);
  });
});

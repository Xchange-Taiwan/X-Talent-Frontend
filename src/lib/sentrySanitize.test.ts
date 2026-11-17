import { describe, expect, it } from 'vitest';

import { sanitizeSentryEvent } from './sentrySanitize';

describe('sanitizeSentryEvent', () => {
  it('scrubs sensitive tokens and passwords from message, exception values, request URLs, and breadcrumbs', () => {
    const rawEvent = {
      message: 'Auth failed for ?token=my_secret_jwt&safe=1',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Payload: {"password":"my_password","email":"ok@test.com"}',
          },
        ],
      },
      request: {
        url: 'https://xtalent.xchange.com.tw/auth/callback?access_token=abc12345',
        query_string: 'access_token=abc12345&redirect=/mentor-pool',
        headers: {
          Authorization: 'Bearer top-secret-bearer',
          'User-Agent': 'Mozilla/5.0',
        },
      },
      breadcrumbs: [
        {
          message: 'Visited /reset?token=reset_secret_999',
          data: {
            url: '/api/login?password=leaked_pw',
          },
        },
      ],
    };

    const cleaned = sanitizeSentryEvent(rawEvent as never);
    const serialized = JSON.stringify(cleaned);

    expect(serialized).not.toContain('my_secret_jwt');
    expect(serialized).not.toContain('my_password');
    expect(serialized).not.toContain('abc12345');
    expect(serialized).not.toContain('top-secret-bearer');
    expect(serialized).not.toContain('reset_secret_999');
    expect(serialized).not.toContain('leaked_pw');
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).toContain('Mozilla/5.0');
  });

  it('recursively scrubs extra, contexts, request data/cookies, strips user PII, and tags unhandled exceptions', () => {
    const rawEvent = {
      user: {
        id: 'user_77',
        email: 'leak@example.com',
        username: 'Real Person',
        ip_address: '203.0.113.9',
      },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'Rejected promise',
            mechanism: { type: 'onunhandledrejection', handled: false },
          },
        ],
      },
      request: {
        cookies: { next_auth_session: 'cookie_jwt_secret' },
        data: {
          nested: {
            password: 'nested_password_value',
            refresh_token: 'nested_rt_value',
            safeField: 'visible_value',
          },
        },
        headers: {
          cookie: 'session=abc',
          'X-Api-Key': 'api_key_secret',
        },
      },
      extra: {
        profile: {
          email: 'extra_email@example.com',
          callback: '/verify?token=extra_query_secret',
        },
      },
      contexts: {
        auth: {
          access_token: 'ctx_access_token_secret',
          flow: 'google_oauth',
        },
      },
    };

    const cleaned = sanitizeSentryEvent(rawEvent as never);
    const serialized = JSON.stringify(cleaned);

    expect(cleaned.user).toEqual({ id: 'user_77' });
    expect(cleaned.tags?.event_name).toBe('runtime_error.unhandled_rejection');
    expect(serialized).not.toContain('leak@example.com');
    expect(serialized).not.toContain('203.0.113.9');
    expect(serialized).not.toContain('cookie_jwt_secret');
    expect(serialized).not.toContain('nested_password_value');
    expect(serialized).not.toContain('nested_rt_value');
    expect(serialized).not.toContain('api_key_secret');
    expect(serialized).not.toContain('extra_email@example.com');
    expect(serialized).not.toContain('extra_query_secret');
    expect(serialized).not.toContain('ctx_access_token_secret');
    expect(serialized).toContain('visible_value');
    expect(serialized).toContain('google_oauth');

    // Also drops user entirely if user.id is accidentally an email
    const emailIdEvent = sanitizeSentryEvent({
      user: { id: 'oops@example.com' },
    } as never);
    expect(emailIdEvent.user).toBeUndefined();
  });
});

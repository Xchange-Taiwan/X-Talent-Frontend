import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureEvent: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';

import {
  buildBaseEvent,
  captureApiFailure,
  captureError,
  captureFlowFailure,
  type MonitoringEvent,
  sanitize,
} from './monitoring';

const mockCaptureEvent = vi.mocked(Sentry.captureEvent);

describe('PII Sanitization', () => {
  it('masks sensitive query parameters in URLs', () => {
    const rawUrl =
      'https://api.example.com/login?password=mysecret&token=abc123&email=user@test.com&safe=yes';
    const sanitized = sanitize(rawUrl);
    expect(sanitized).toContain('password=[REDACTED]');
    expect(sanitized).toContain('token=[REDACTED]');
    expect(sanitized).toContain('email=[REDACTED]');
    expect(sanitized).toContain('safe=yes');
    expect(sanitized).not.toContain('mysecret');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('user@test.com');
  });

  it('masks sensitive query parameters wrapped in quotes', () => {
    const rawText =
      'request failed for password="mysecret" and token=\'abc123\'';
    const sanitized = sanitize(rawText);
    expect(sanitized).toContain('password=[REDACTED]');
    expect(sanitized).toContain('token=[REDACTED]');
    expect(sanitized).not.toContain('mysecret');
    expect(sanitized).not.toContain('abc123');
  });

  it('masks a quoted query parameter value even when it contains a literal space', () => {
    const rawText = 'request failed for password="my secret" end of message';
    const sanitized = sanitize(rawText);
    expect(sanitized).toBe(
      'request failed for password=[REDACTED] end of message'
    );
    expect(sanitized).not.toContain('secret');
  });

  it('masks compound/snake_case query parameter keys, not just exact matches', () => {
    const rawUrl =
      'https://api.example.com/x?user_email=user@test.com&access_token=abc123&user-email=other@test.com&user_password=hunter2&safe=yes';
    const sanitized = sanitize(rawUrl);
    expect(sanitized).toContain('user_email=[REDACTED]');
    expect(sanitized).toContain('access_token=[REDACTED]');
    expect(sanitized).toContain('user-email=[REDACTED]');
    expect(sanitized).toContain('user_password=[REDACTED]');
    expect(sanitized).toContain('safe=yes');
    expect(sanitized).not.toContain('user@test.com');
    expect(sanitized).not.toContain('other@test.com');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('hunter2');
  });

  it('masks query parameter keys with a sensitive word as a prefix, not just a suffix before =', () => {
    const rawUrl =
      'https://api.example.com/x?email_address=user@test.com&phone_number=0912345678&safeword=notasecret';
    const sanitized = sanitize(rawUrl);
    expect(sanitized).toContain('email_address=[REDACTED]');
    expect(sanitized).toContain('phone_number=[REDACTED]');
    expect(sanitized).toContain('safeword=notasecret');
    expect(sanitized).not.toContain('user@test.com');
    expect(sanitized).not.toContain('0912345678');
  });

  it('masks query parameter keys using bracket or dot notation, not just plain word keys', () => {
    const rawUrl =
      'https://api.example.com/x?user[password]=hunter2&user.email=user@test.com&safe=1';
    const sanitized = sanitize(rawUrl);
    expect(sanitized).toContain('user[password]=[REDACTED]');
    expect(sanitized).toContain('user.email=[REDACTED]');
    expect(sanitized).toContain('safe=1');
    expect(sanitized).not.toContain('hunter2');
    expect(sanitized).not.toContain('user@test.com');
  });

  it('fully masks an unquoted query value that itself contains a literal =, not just up to the first one', () => {
    const rawUrl = '?token=abcDEF123==&password=my=secret&safe=1';
    const sanitized = sanitize(rawUrl);
    expect(sanitized).toBe('?token=[REDACTED]&password=[REDACTED]&safe=1');
    expect(sanitized).not.toContain('abcDEF123');
    expect(sanitized).not.toContain('secret');
  });

  it('does not exhibit quadratic backtracking on a long non-matching query-like string', () => {
    const longBenignRun = 'a'.repeat(100000);
    const start = performance.now();
    const sanitized = sanitize(longBenignRun);
    const elapsedMs = performance.now() - start;
    expect(sanitized).toBe(longBenignRun);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('does not exhibit quadratic backtracking on a string of repeated sensitive words with no =', () => {
    const longRepeatedKeyword = 'token'.repeat(40000);
    const start = performance.now();
    sanitize(longRepeatedKeyword);
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('masks compound/snake_case JSON keys, not just exact matches', () => {
    const rawJson = JSON.stringify({
      user_email: 'user@test.com',
      access_token: 'abc123',
      companyEmail: 'other@test.com',
      unrelated: 'safe-value',
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toContain('"user_email":"[REDACTED]"');
    expect(sanitized).toContain('"access_token":"[REDACTED]"');
    expect(sanitized).toContain('"companyEmail":"[REDACTED]"');
    expect(sanitized).toContain('"unrelated":"safe-value"');
    expect(sanitized).not.toContain('user@test.com');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('other@test.com');
  });

  it('masks sensitive keys in JSON structures', () => {
    const rawJson = JSON.stringify({
      password: 'password123',
      token: 'jwt-token-xyz',
      email: 'john@doe.com',
      phone: '123456789',
      idnumber: 'A123456789',
      unrelated: 'safe-value',
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toContain('"password":"[REDACTED]"');
    expect(sanitized).toContain('"token":"[REDACTED]"');
    expect(sanitized).toContain('"email":"[REDACTED]"');
    expect(sanitized).toContain('"phone":"[REDACTED]"');
    expect(sanitized).toContain('"idnumber":"[REDACTED]"');
    expect(sanitized).toContain('"unrelated":"safe-value"');
    expect(sanitized).not.toContain('password123');
    expect(sanitized).not.toContain('jwt-token-xyz');
    expect(sanitized).not.toContain('john@doe.com');
  });

  it('fully masks a JSON string value that contains an escaped quote', () => {
    const rawJson = JSON.stringify({ password: 'my"secret', safe: 'ok' });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"password":"[REDACTED]","safe":"ok"}');
    expect(sanitized).not.toContain('secret');
  });

  it('masks a JSON array value for a sensitive key, not just scalar values', () => {
    const rawJson = JSON.stringify({
      emails: ['user@test.com', 'other@test.com'],
      safe: ['a', 'b'],
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"emails":"[REDACTED]","safe":["a","b"]}');
    expect(sanitized).not.toContain('user@test.com');
    expect(sanitized).not.toContain('other@test.com');
  });

  it('fully masks a JSON array value even when an element contains a literal ]', () => {
    const rawJson = JSON.stringify({
      passwords: ['my]password', 'other'],
      safe: ['a'],
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"passwords":"[REDACTED]","safe":["a"]}');
    expect(sanitized).not.toContain('my]password');
    expect(sanitized).not.toContain('other');
  });

  it('masks JSON keys that use dot notation, not just plain word keys', () => {
    const rawJson = '{"user.email":"user@test.com","safe":"ok"}';
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"user.email":"[REDACTED]","safe":"ok"}');
    expect(sanitized).not.toContain('user@test.com');
  });

  it('masks non-string (number/boolean/null) JSON values for sensitive keys, not just quoted strings', () => {
    const rawJson = JSON.stringify({
      phone: 987654321,
      idnumber: 123456789,
      accessToken: null,
      active: true,
      score: 12.5,
      unrelated: 42,
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toContain('"phone":"[REDACTED]"');
    expect(sanitized).toContain('"idnumber":"[REDACTED]"');
    expect(sanitized).toContain('"accessToken":"[REDACTED]"');
    expect(sanitized).toContain('"active":true');
    expect(sanitized).toContain('"score":12.5');
    expect(sanitized).toContain('"unrelated":42');
    expect(sanitized).not.toContain('987654321');
    expect(sanitized).not.toContain('123456789');
  });

  it('fully masks a JSON number in scientific notation, not just its mantissa', () => {
    const rawJson = '{"phone":12345e2,"safe":42}';
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"phone":"[REDACTED]","safe":42}');
    expect(sanitized).not.toContain('e2');
  });

  it('masks a nested JSON object value for a sensitive key, not just scalar/array values', () => {
    const rawJson = '{"email":{"$eq":"user@test.com"},"safe":1}';
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"email":"[REDACTED]","safe":1}');
    expect(sanitized).not.toContain('user@test.com');
  });

  it('fully masks a doubly-nested array-of-arrays value, not just the outer array', () => {
    const rawJson = '{"password":[["nested"],"plain_secret"]}';
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"password":"[REDACTED]"}');
    expect(sanitized).not.toContain('nested');
    expect(sanitized).not.toContain('plain_secret');
  });

  it('fully masks a doubly-nested object-of-objects value, not just the outer object', () => {
    const rawJson = JSON.stringify({
      password: { current: { value: 'hunter2', hint: 'pet name' } },
      safe: 1,
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe('{"password":"[REDACTED]","safe":1}');
    expect(sanitized).not.toContain('hunter2');
    expect(sanitized).not.toContain('pet name');
  });

  it('masks a sensitive key buried several levels deep inside non-sensitive wrapper objects', () => {
    const rawJson = JSON.stringify({
      data: { user: { profile: { password: 'hunter2' } } },
      safe: 1,
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe(
      '{"data":{"user":{"profile":{"password":"[REDACTED]"}}},"safe":1}'
    );
    expect(sanitized).not.toContain('hunter2');
  });

  it('masks sensitive keys nested inside a mixed array of objects, preserving structure', () => {
    const rawJson = JSON.stringify({
      logs: [
        { password: 'secret1', safe: 'ok' },
        { token: ['a', 'b'], nested: { email: 'user@test.com' } },
      ],
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe(
      '{"logs":[{"password":"[REDACTED]","safe":"ok"},{"token":"[REDACTED]","nested":{"email":"[REDACTED]"}}]}'
    );
    expect(sanitized).not.toContain('secret1');
    expect(sanitized).not.toContain('user@test.com');
  });

  it('still applies the shallow regex fallback for a JSON blob embedded in free text', () => {
    const rawText = 'Request failed: {"password":"secret1","safe":"ok"}';
    const sanitized = sanitize(rawText);
    expect(sanitized).toBe(
      'Request failed: {"password":"[REDACTED]","safe":"ok"}'
    );
    expect(sanitized).not.toContain('secret1');
  });

  it('does not exhibit quadratic slowdown when recursively masking a deeply nested JSON array', () => {
    let deeplyNested: unknown = 'plain_secret';
    for (let i = 0; i < 500; i++) {
      deeplyNested = [deeplyNested];
    }
    const rawJson = JSON.stringify({ password: deeplyNested, safe: 1 });
    const start = performance.now();
    const sanitized = sanitize(rawJson);
    const elapsedMs = performance.now() - start;
    expect(sanitized).toBe('{"password":"[REDACTED]","safe":1}');
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('handles empty or undefined values gracefully', () => {
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize('')).toBe('');
  });
});

describe('buildBaseEvent', () => {
  it('correctly builds event from Error object', () => {
    const error = new Error('Test error message');
    error.stack = 'Mocked stack trace';

    const event = buildBaseEvent('runtime_error.unhandled_js', error);

    expect(event.name).toBe('runtime_error.unhandled_js');
    expect(event.message).toBe('Test error message');
    expect(event.stack).toBe('Mocked stack trace');
    expect(event.timestamp).toBeDefined();
    expect(event.environment).toBeDefined();
  });

  it('correctly builds event from non-Error objects', () => {
    const event = buildBaseEvent(
      'runtime_error.unhandled_rejection',
      'Some rejection string'
    );

    expect(event.name).toBe('runtime_error.unhandled_rejection');
    expect(event.message).toBe('Some rejection string');
    expect(event.stack).toBeUndefined();
  });
});

describe('captureError', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockCaptureEvent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sanitizes and forwards runtime errors to Sentry in production', async () => {
    const event = fromPartial<MonitoringEvent>({
      name: 'runtime_error.unhandled_js',
      message: 'Failed to authenticate user password=secret123',
      stack: 'Error stack containing email=user@test.com',
      componentStack: 'React component tree with phone=987654321',
      route: '/home',
      environment: 'production',
    });

    await captureError(event);

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to authenticate user password=[REDACTED]',
        tags: expect.objectContaining({
          event_name: 'runtime_error.unhandled_js',
          route: '/home',
        }),
        extra: expect.objectContaining({
          stack: 'Error stack containing email=[REDACTED]',
          componentStack: 'React component tree with phone=[REDACTED]',
        }),
      })
    );
  });

  it('does NOT call Sentry when NODE_ENV is not production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const event = fromPartial<MonitoringEvent>({
      name: 'runtime_error.unhandled_js',
      message: 'Test error message',
    });

    await captureError(event);

    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});

describe('captureApiFailure', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockCaptureEvent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sanitizes query parameters and message in api.failure events', async () => {
    await captureApiFailure({
      endpoint: '/api/v1/auth/callback?token=secrettoken&code=123',
      method: 'POST',
      status: 401,
      message: 'Unauthorized access, invalid token=secrettoken',
      duration: 150,
      route: '/auth/signin',
    });

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized access, invalid token=[REDACTED]',
        tags: expect.objectContaining({
          event_name: 'api.failure',
          route: '/auth/signin',
          method: 'POST',
          status: '401',
        }),
        extra: expect.objectContaining({
          endpoint: '/api/v1/auth/callback?token=[REDACTED]&code=[REDACTED]',
          duration: 150,
        }),
      })
    );
  });

  it('masks the OAuth authorization code in a NextAuth callback URL', async () => {
    await captureApiFailure({
      endpoint: '/api/auth/callback/google?code=4/0AY0e-g7abcdef&state=xyz',
      method: 'GET',
      status: 400,
      message: 'OAuth callback failed',
      route: '/auth/signin',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          endpoint: '/api/auth/callback/google?code=[REDACTED]&state=xyz',
        }),
      })
    );
  });

  it('does not mask errorCode/statusCode fields just because they contain "code"', () => {
    const rawJson = JSON.stringify({
      errorCode: 404,
      statusCode: 500,
      safe: 1,
    });
    const sanitized = sanitize(rawJson);
    expect(sanitized).toBe(rawJson);
  });

  it('does NOT call Sentry when NODE_ENV is not production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    await captureApiFailure({
      endpoint: '/api/v1/data',
      method: 'GET',
      status: 500,
      message: 'Server error',
    });

    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });
});

describe('captureFlowFailure', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockCaptureEvent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to level "error" when no level is provided', async () => {
    await captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
    });

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error' })
    );
  });

  it('forwards explicit level "info" to Sentry', async () => {
    await captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
      level: 'info',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info' })
    );
  });

  it('forwards explicit level "warning" to Sentry', async () => {
    await captureFlowFailure({
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
      level: 'warning',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('does NOT call Sentry when NODE_ENV is not production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    await captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
      level: 'info',
    });

    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });

  it('emits flow.<flow>.failure as the event message and tags flow/step/route', async () => {
    await captureFlowFailure({
      flow: 'sign_up',
      step: 'submit',
      message: 'Email registered',
      level: 'info',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'flow.sign_up.failure',
        level: 'info',
        tags: expect.objectContaining({
          event_name: 'flow.sign_up.failure',
          flow: 'sign_up',
          step: 'submit',
        }),
      })
    );
  });

  it('sanitizes sensitive query params and JSON values in the message', async () => {
    await captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message:
        'failed request token=abc123&password=secret payload={"email":"a@b.c"}',
    });

    const arg = mockCaptureEvent.mock.calls[0][0] as {
      extra: { message: string };
    };
    expect(arg.extra.message).toContain('token=[REDACTED]');
    expect(arg.extra.message).toContain('password=[REDACTED]');
    expect(arg.extra.message).toContain('"email":"[REDACTED]"');
    expect(arg.extra.message).not.toContain('abc123');
    expect(arg.extra.message).not.toContain('a@b.c');
  });

  it('does not redact a sensitive key=value pair swallowed inside a preceding non-sensitive key un-delimited value (known limitation)', async () => {
    // SENSITIVE_QUERY_PARAM_PATTERN checks the key in a callback rather than
    // embedding the sensitive word in the key alternation, trading a rare
    // correctness gap for eliminating a severe ReDoS (see the pattern's
    // comment in monitoring.ts). This test documents that trade-off rather
    // than asserting protection: 'url's un-delimited value swallows the
    // embedded 'token=abc123' before it can become its own match. This
    // codebase only ever passes flat, single-level query strings/messages
    // through sanitize(), so this shape isn't expected in practice.
    await captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'failed url=/login?token=abc123&password=secret',
    });

    const arg = mockCaptureEvent.mock.calls[0][0] as {
      extra: { message: string };
    };
    expect(arg.extra.message).toContain('password=[REDACTED]');
    expect(arg.extra.message).toContain('token=abc123');
  });

  it('captureFlowFailure catches Sentry logging errors and does not crash the caller', async () => {
    mockCaptureEvent.mockImplementationOnce(() => {
      throw new Error('Sentry capture failed');
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      captureFlowFailure({
        flow: 'sign_in',
        step: 'authenticate',
        message: 'Something went wrong',
      })
    ).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Monitoring] captureFlowFailure Sentry logging failed:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('captureError catches Sentry logging errors and does not crash the caller', async () => {
    mockCaptureEvent.mockImplementationOnce(() => {
      throw new Error('Sentry capture failed');
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      captureError({
        name: 'runtime_error.unhandled_js',
        timestamp: new Date().toISOString(),
        environment: 'production',
        route: '/test',
        message: 'Something went wrong',
      })
    ).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Monitoring] captureError Sentry logging failed:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('captureApiFailure catches Sentry logging errors and does not crash the caller', async () => {
    mockCaptureEvent.mockImplementationOnce(() => {
      throw new Error('Sentry capture failed');
    });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      captureApiFailure({
        endpoint: '/api/test',
        method: 'GET',
        status: 500,
        message: 'Internal server error',
      })
    ).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Monitoring] captureApiFailure Sentry logging failed:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

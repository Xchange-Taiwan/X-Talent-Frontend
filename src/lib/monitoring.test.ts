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
    const event = fromPartial({
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

    const event = fromPartial({
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
          endpoint: '/api/v1/auth/callback?token=[REDACTED]&code=123',
          duration: 150,
        }),
      })
    );
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
        'failed url=/login?token=abc123&password=secret payload={"email":"a@b.c"}',
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

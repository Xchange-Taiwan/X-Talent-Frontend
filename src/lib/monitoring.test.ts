import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureEvent: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';

import {
  captureApiFailure,
  captureError,
  captureFlowFailure,
} from './monitoring';

const mockCaptureEvent = vi.mocked(Sentry.captureEvent);

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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureEvent: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';

import { captureFlowFailure } from './monitoring';

const mockCaptureEvent = vi.mocked(Sentry.captureEvent);

describe('captureFlowFailure', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    mockCaptureEvent.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to level "error" when no level is provided', () => {
    captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
    });

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error' })
    );
  });

  it('forwards explicit level "info" to Sentry', () => {
    captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
      level: 'info',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info' })
    );
  });

  it('forwards explicit level "warning" to Sentry', () => {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
      level: 'warning',
    });

    expect(mockCaptureEvent).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('does NOT call Sentry when NODE_ENV is not production', () => {
    vi.stubEnv('NODE_ENV', 'test');

    captureFlowFailure({
      flow: 'sign_in',
      step: 'authenticate',
      message: 'Invalid credentials',
      level: 'info',
    });

    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });

  it('emits flow.<flow>.failure as the event message and tags flow/step/route', () => {
    captureFlowFailure({
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

  it('sanitizes sensitive query params and JSON values in the message', () => {
    captureFlowFailure({
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
});

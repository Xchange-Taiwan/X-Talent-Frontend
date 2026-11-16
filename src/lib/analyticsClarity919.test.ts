import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildSafeClarityPlaybackUrl,
  clearAnalyticsUser,
  getActiveClarityPlaybackUrl,
  initClarity,
  initGa4,
  registerClarityMetadataListener,
  resetAnalyticsUserState,
  setAnalyticsUserContext,
  trackEvent,
  upgradeClaritySession,
} from './analytics';

describe('Clarity session identity, playback URL, and failure upgrade (#919)', () => {
  beforeEach(() => {
    resetAnalyticsUserState();
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it('validates Clarity metadata payloads strictly and produces /player/<pid>/<uid>/<sid> URLs', () => {
    expect(
      buildSafeClarityPlaybackUrl({
        projectId: 'vwimm8rumd',
        userId: 'u_123',
        sessionId: 's-456',
      })
    ).toBe('https://clarity.microsoft.com/player/vwimm8rumd/u_123/s-456');

    expect(buildSafeClarityPlaybackUrl(null)).toBeNull();
    expect(
      buildSafeClarityPlaybackUrl({
        projectId: 'vwimm8rumd',
        userId: 'user@example.com',
        sessionId: 's1',
      })
    ).toBeNull();
    expect(
      buildSafeClarityPlaybackUrl({
        projectId: '../evil',
        userId: 'u1',
        sessionId: 's1',
      })
    ).toBeNull();
  });

  it('synchronizes deduplicated clarity("identify", safeUserId) without friendlyName and resets on logout', () => {
    const claritySpy = vi.fn();
    window.clarity = claritySpy as unknown as typeof window.clarity;
    initGa4('G-WDTM4GQ3TN');
    initClarity('vwimm8rumd');

    setAnalyticsUserContext({ userId: '7488864558908473', userRole: 'mentor' });
    setAnalyticsUserContext({ userId: '7488864558908473', userRole: 'mentor' });

    const identifyCalls = claritySpy.mock.calls.filter(
      (args) => args[0] === 'identify'
    );
    expect(identifyCalls).toHaveLength(1);
    expect(identifyCalls[0]).toEqual(['identify', '7488864558908473']);

    // Logout clears cached identify key and active playback URL so re-login starts fresh
    const clarityWithMeta = vi.fn((cmd: string, cb?: unknown) => {
      if (cmd === 'metadata' && typeof cb === 'function') {
        (cb as (d: unknown) => void)({
          projectId: 'vwimm8rumd',
          userId: 'u9',
          sessionId: 's9',
        });
      }
    });
    window.clarity = clarityWithMeta as unknown as typeof window.clarity;
    registerClarityMetadataListener();
    expect(getActiveClarityPlaybackUrl()).not.toBeNull();

    clearAnalyticsUser();
    expect(getActiveClarityPlaybackUrl()).toBeNull();

    window.clarity = claritySpy as unknown as typeof window.clarity;
    setAnalyticsUserContext({ userId: '7488864558908473', userRole: 'mentor' });
    const identifyCallsAfterRelogin = claritySpy.mock.calls.filter(
      (args) => args[0] === 'identify'
    );
    expect(identifyCallsAfterRelogin).toHaveLength(2);
  });

  it('attaches clarity_playback_url to all 5 diagnostic events without echoing to clarity("set"), and upgrades only failure events', () => {
    const gtagSpy = vi.fn();
    const claritySpy = vi.fn((command: string, arg1?: unknown) => {
      if (command === 'metadata' && typeof arg1 === 'function') {
        (arg1 as (d: unknown) => void)({
          projectId: 'vwimm8rumd',
          userId: 'cl_user_1',
          sessionId: 'cl_sess_9',
        });
      }
    });

    window.gtag = gtagSpy as unknown as typeof window.gtag;
    window.clarity = claritySpy as unknown as typeof window.clarity;

    initGa4('G-WDTM4GQ3TN');
    registerClarityMetadataListener();

    const expectedPlaybackUrl =
      'https://clarity.microsoft.com/player/vwimm8rumd/cl_user_1/cl_sess_9';
    expect(getActiveClarityPlaybackUrl()).toBe(expectedPlaybackUrl);

    const diagnosticEvents = [
      'mentor_no_available_slots',
      'auth_gate_triggered',
      'mentor_search_zero_results',
      'booking_submit_failed',
      'auth_flow_failed',
    ] as const;

    for (const evName of diagnosticEvents) {
      trackEvent({
        name: evName,
        feature: 'reservation',
        metadata: { mentor_id: 123 },
      });
    }

    // Non-diagnostic success event must NOT carry clarity_playback_url or trigger upgrade
    trackEvent({
      name: 'reservation_booking_confirmed',
      feature: 'reservation',
      metadata: { mentor_id: 123 },
    });

    const gaEventCalls = gtagSpy.mock.calls.filter((c) => c[0] === 'event');
    expect(gaEventCalls).toHaveLength(6);

    for (let i = 0; i < 5; i++) {
      expect(gaEventCalls[i][1]).toBe(diagnosticEvents[i]);
      expect(gaEventCalls[i][2]).toMatchObject({
        clarity_playback_url: expectedPlaybackUrl,
      });
    }
    expect(gaEventCalls[5][1]).toBe('reservation_booking_confirmed');
    expect(gaEventCalls[5][2]).not.toHaveProperty('clarity_playback_url');

    // clarity('set', 'clarity_playback_url', ...) must never be called
    const setPlaybackCalls = claritySpy.mock.calls.filter(
      (c) => c[0] === 'set' && c[1] === 'clarity_playback_url'
    );
    expect(setPlaybackCalls).toHaveLength(0);

    // clarity('upgrade', ...) must ONLY fire on the 2 failure events
    const upgradeCalls = claritySpy.mock.calls
      .filter((c) => c[0] === 'upgrade')
      .map((c) => c[1]);
    expect(upgradeCalls).toEqual(['booking_submit_failed', 'auth_flow_failed']);
  });

  it('blocks PII or invalid tokens in upgradeClaritySession', () => {
    const claritySpy = vi.fn();
    window.clarity = claritySpy as unknown as typeof window.clarity;

    upgradeClaritySession('user@example.com');
    upgradeClaritySession('email');
    upgradeClaritySession('bad space reason');
    expect(claritySpy).not.toHaveBeenCalled();

    upgradeClaritySession('booking_submit_failed');
    expect(claritySpy).toHaveBeenCalledWith('upgrade', 'booking_submit_failed');
  });

  it('queues early calls in window.clarity.q before external script loads, then idempotently registers metadata on script onLoad', () => {
    expect(window.clarity).toBeUndefined();

    // 1. Bootstrap initializes stub queue while external script is still downloading
    expect(initClarity('vwimm8rumd')).toBe(true);
    expect(typeof window.clarity).toBe('function');
    expect(Array.isArray(window.clarity?.q)).toBe(true);
    // Stub queue must NOT eagerly invoke metadata registration before real script arrives
    expect(window.clarity?.q).toHaveLength(0);

    // Early user context sync buffers into window.clarity.q
    setAnalyticsUserContext({ userId: '998877', userRole: 'mentee' });
    const queuedCommands = (window.clarity?.q ?? []).map((entry) =>
      Array.from(entry as ArrayLike<unknown>)
    );
    expect(queuedCommands).toContainEqual(['set', 'user_role', 'mentee']);
    expect(queuedCommands).toContainEqual(['identify', '998877']);

    // 2. External script finishes loading and replaces window.clarity
    const realClarity = vi.fn((cmd: string, cb?: unknown) => {
      if (cmd === 'metadata' && typeof cb === 'function') {
        (cb as (d: unknown) => void)({
          projectId: 'vwimm8rumd',
          userId: 'live_u1',
          sessionId: 'live_s1',
        });
      }
    });
    window.clarity = realClarity as unknown as typeof window.clarity;

    // 3. AnalyticsBootstrap onLoad calls registerClarityMetadataListener() idempotently
    expect(registerClarityMetadataListener()).toBe(true);
    expect(registerClarityMetadataListener()).toBe(true);
    expect(
      realClarity.mock.calls.filter((c) => c[0] === 'metadata')
    ).toHaveLength(1);
    expect(getActiveClarityPlaybackUrl()).toBe(
      'https://clarity.microsoft.com/player/vwimm8rumd/live_u1/live_s1'
    );
  });
});

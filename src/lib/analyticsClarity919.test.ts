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

    // Logout clears cached identify key so re-login re-identifies cleanly
    clearAnalyticsUser();
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
});

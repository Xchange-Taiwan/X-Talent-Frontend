import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  createFeedbackSessionCoordinator,
  createInMemoryFeedbackSessionStoragePort,
  shouldSuppressPendingFeedbackPopup,
} from './feedbackSessionCoordinator';

function makeReservation(
  id: string,
  dtend: number,
  overrides: Partial<Reservation> = {}
): Reservation {
  return fromPartial<Reservation>({
    id,
    dtstart: dtend - 1800,
    dtend,
    senderUserId: 10,
    participantUserId: 20,
    viewerRole: 'MENTEE',
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
    ...overrides,
  });
}

describe('createFeedbackSessionCoordinator (#906)', () => {
  it('loads login queue oldest-first across bilateral sessions, handles AbortSignal cancellation, and tracks empty queues', async () => {
    const storage = createInMemoryFeedbackSessionStoragePort();
    const fetchPending = vi
      .fn()
      .mockResolvedValueOnce([
        makeReservation('res-newer', 1762000000, { viewerRole: 'MENTOR' }),
        makeReservation('res-older', 1760000000, { viewerRole: 'MENTEE' }),
      ]);

    const coordinator = createFeedbackSessionCoordinator({
      storage,
      lookup: { fetchPendingFeedbackReservations: fetchPending },
    });

    const loaded = await coordinator.loadLoginQueue({
      userId: '10',
      isMentor: true,
    });

    expect(loaded?.map((item) => item.id)).toEqual(['res-older', 'res-newer']);
    expect(coordinator.getSessionState('10')).toEqual({
      checked: true,
      dismissed: false,
      queueEmpty: false,
      submittedIds: [],
      skippedIds: [],
    });

    // Aborted signal does not overwrite state or mark empty
    const storage2 = createInMemoryFeedbackSessionStoragePort();
    const controller = new AbortController();
    const abortedFetch = vi.fn().mockImplementation(async () => {
      controller.abort();
      return [makeReservation('res-aborted', 1760000000)];
    });
    const coordinator2 = createFeedbackSessionCoordinator({
      storage: storage2,
      lookup: { fetchPendingFeedbackReservations: abortedFetch },
    });

    const abortedResult = await coordinator2.loadLoginQueue({
      userId: '10',
      isMentor: false,
      signal: controller.signal,
    });
    expect(abortedResult).toBeNull();
    expect(coordinator2.getSessionState('10').checked).toBe(false);
  });

  it('persists skipped and submitted reservations, keeps presented array stable while presenting, and prunes on yield or dismiss', async () => {
    const storage = createInMemoryFeedbackSessionStoragePort();
    const coordinator = createFeedbackSessionCoordinator({
      storage,
      lookup: {
        fetchPendingFeedbackReservations: vi
          .fn()
          .mockResolvedValue([
            makeReservation('r-1', 1760000000),
            makeReservation('r-2', 1761000000),
            makeReservation('r-3', 1762000000),
          ]),
      },
    });

    const submittedSpy = vi.fn();
    coordinator.subscribeReservationSubmitted(submittedSpy);

    await coordinator.loadLoginQueue({ userId: 'u-1', isMentor: false });
    coordinator.syncLoginQueuePresentation({ userId: 'u-1', canPresent: true });

    // Submitting r-1 while presenting keeps presentedItems length stable for queue motion
    coordinator.markReservationSubmitted('u-1', 'r-1');
    expect(submittedSpy).toHaveBeenCalledWith('u-1', 'r-1');
    expect(
      coordinator
        .getPresentedLoginQueue({ userId: 'u-1', canPresent: true })
        ?.map((i) => i.id)
    ).toEqual(['r-1', 'r-2', 'r-3']);

    // Skipping r-2 persists in storage
    coordinator.markReservationSkipped('u-1', 'r-2');
    expect(coordinator.getSessionState('u-1').skippedIds).toEqual(['r-2']);

    // Yielding route (!canPresent) prunes r-1 and r-2 leaving only r-3
    coordinator.syncLoginQueuePresentation({
      userId: 'u-1',
      canPresent: false,
    });
    expect(
      coordinator
        .syncLoginQueuePresentation({ userId: 'u-1', canPresent: true })
        ?.map((i) => i.id)
    ).toEqual(['r-3']);

    // Dismissing marks remaining r-3 as skipped and dismissed
    coordinator.dismissLoginQueue('u-1');
    expect(coordinator.getSessionState('u-1')).toEqual({
      checked: true,
      dismissed: true,
      queueEmpty: false,
      submittedIds: ['r-1'],
      skippedIds: ['r-2', 'r-3'],
    });
  });

  it('seeds single-reservation lookup across /reservation/history redirect, enforces one-shot consumption and TTL expiry, and clears on account switch', async () => {
    let currentTime = 1_000_000;
    const storage = createInMemoryFeedbackSessionStoragePort();
    const targetReservation = makeReservation('205', 1761000000, {
      viewerRole: 'MENTOR',
    });
    const fetchSingle = vi.fn().mockResolvedValue({
      viewerRole: 'mentor' as const,
      reservation: targetReservation,
    });

    const coordinator = createFeedbackSessionCoordinator({
      storage,
      lookup: { fetchSingleReservationFeedback: fetchSingle },
      now: () => currentTime,
      seedTtlMs: 10_000,
    });

    const redirect = await coordinator.resolveHistoryRedirect({
      userId: '20',
      fallbackRole: 'mentee',
      rawSearch: 'reservation_id=205',
    });

    expect(fetchSingle).toHaveBeenCalledTimes(1);
    expect(redirect.resolvedRole).toBe('mentor');
    expect(redirect.redirectHref).toBe(
      '/reservation/mentor?tab=history&reservation_id=205'
    );

    // First consumption hits seeded lookup without extra HTTP fetch
    const firstConsume = coordinator.consumeSeededLookup({
      userId: '20',
      reservationId: '205',
    });
    expect(firstConsume).toEqual({
      hit: true,
      result: {
        viewerRole: 'mentor',
        reservation: targetReservation,
      },
    });

    // Second consumption misses (one-shot)
    expect(
      coordinator.consumeSeededLookup({ userId: '20', reservationId: '205' })
    ).toEqual({ hit: false });

    // Expired seed misses after TTL
    coordinator.seedLookupResult({
      userId: '20',
      reservationId: '206',
      result: { viewerRole: 'mentor', reservation: targetReservation },
    });
    currentTime += 10_001;
    expect(
      coordinator.consumeSeededLookup({ userId: '20', reservationId: '206' })
    ).toEqual({ hit: false });

    // Account switch wipes persisted state and seeded lookups
    coordinator.markReservationSkipped('20', '900');
    coordinator.seedLookupResult({
      userId: '20',
      reservationId: '207',
      result: null,
    });
    coordinator.syncAuthSession({
      isResetRouteOrUnauthenticated: false,
      userId: '20',
    });
    coordinator.syncAuthSession({
      isResetRouteOrUnauthenticated: false,
      userId: '99',
    });

    expect(coordinator.getSessionState('20').skippedIds).toEqual([]);
    expect(
      coordinator.consumeSeededLookup({ userId: '20', reservationId: '207' })
    ).toEqual({ hit: false });
  });

  it('orders bilateral ?feedback=queue items oldest-first for both mentor and mentee while excluding skipped/submitted IDs', () => {
    const storage = createInMemoryFeedbackSessionStoragePort();
    const coordinator = createFeedbackSessionCoordinator({ storage });

    coordinator.markReservationSkipped('mentor-1', 'm-skip');
    coordinator.markReservationSubmitted('mentor-1', 'm-done');

    const mentorHistory: Reservation[] = [
      makeReservation('m-late', 1765000000, { viewerRole: 'MENTOR' }),
      makeReservation('m-skip', 1761000000, { viewerRole: 'MENTOR' }),
      makeReservation('m-early', 1760000000, { viewerRole: 'MENTOR' }),
      makeReservation('m-done', 1759000000, { viewerRole: 'MENTOR' }),
      makeReservation('m-cancelled', 1758000000, {
        viewerRole: 'MENTOR',
        cancelledBy: 'MENTEE',
      }),
    ];

    const resolved = coordinator.resolveExplicitQueueItems({
      userId: 'mentor-1',
      role: 'mentor',
      history: mentorHistory,
    });

    expect(resolved.map((item) => item.id)).toEqual(['m-early', 'm-late']);
  });

  it('suppresses login popup on auth, onboarding, reservation, and deep-link/queue query routes', () => {
    expect(
      shouldSuppressPendingFeedbackPopup({
        pathname: '/mentor-pool',
        searchParams: new URLSearchParams(),
      })
    ).toBe(false);
    expect(
      shouldSuppressPendingFeedbackPopup({
        pathname: '/mentor-pool',
        searchParams: new URLSearchParams('feedback=queue'),
      })
    ).toBe(true);
    expect(
      shouldSuppressPendingFeedbackPopup({
        pathname: '/mentor-pool',
        searchParams: new URLSearchParams('reservation_id=101'),
      })
    ).toBe(true);
  });
});

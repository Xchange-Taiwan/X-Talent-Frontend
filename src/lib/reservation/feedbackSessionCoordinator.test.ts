import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import * as monitoring from '@/lib/monitoring';
import type { Reservation } from '@/types/reservation';

import {
  createFeedbackSessionCoordinator,
  createInMemoryFeedbackSessionLookupPort,
  createInMemoryFeedbackSessionStoragePort,
  defaultFeedbackSessionLookupPort,
  feedbackSessionCoordinator,
  MAX_DEEP_LINK_LOAD_MORE_PAGES,
  resolveDeepLinkOutcome,
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

    // Non-aborted fetch error reports to onError callback without writing checked=true
    const onError = vi.fn();
    const failingCoordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: {
        fetchPendingFeedbackReservations: vi
          .fn()
          .mockRejectedValueOnce(new Error('503 Unavailable')),
      },
      onError,
    });
    expect(
      await failingCoordinator.loadLoginQueue({
        userId: '10',
        isMentor: false,
      })
    ).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      step: 'load_login_queue',
      userId: '10',
    });
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

  it('tracks one-shot consumeLoginPromptShown and idempotent dismissLoginQueue dismissedSkippedCount across partial submits (#950)', async () => {
    const storage = createInMemoryFeedbackSessionStoragePort();
    const coordinator = createFeedbackSessionCoordinator({
      storage,
      lookup: {
        fetchPendingFeedbackReservations: vi
          .fn()
          .mockResolvedValue([
            makeReservation('t-1', 1760000000),
            makeReservation('t-2', 1761000000),
            makeReservation('t-3', 1762000000),
          ]),
      },
    });

    await coordinator.loadLoginQueue({ userId: 'u-9', isMentor: false });

    // Suppressed (!canPresent) returns null without consuming the one-shot token
    expect(
      coordinator.consumeLoginPromptShown({ userId: 'u-9', canPresent: false })
    ).toBeNull();

    // First eligible presentation returns 3; repeat calls return null
    expect(
      coordinator.consumeLoginPromptShown({ userId: 'u-9', canPresent: true })
    ).toBe(3);
    expect(
      coordinator.consumeLoginPromptShown({ userId: 'u-9', canPresent: true })
    ).toBeNull();

    // Submit t-1, skip t-2, leave t-3 unaddressed -> dismissLoginQueue reports 2 once, then 0 on repeat
    coordinator.markReservationSubmitted('u-9', 't-1');
    coordinator.markReservationSkipped('u-9', 't-2');
    expect(coordinator.dismissLoginQueue('u-9')).toEqual({
      dismissedSkippedCount: 2,
    });
    expect(coordinator.dismissLoginQueue('u-9')).toEqual({
      dismissedSkippedCount: 0,
    });
  });
});

describe('FeedbackSessionCoordinator core APIs — Login & History Redirect (#944)', () => {
  it('wires defaultFeedbackSessionLookupPort on the default singleton without circular dependency and supports unauthenticated/disabled resolveHistoryRedirect', async () => {
    expect(defaultFeedbackSessionLookupPort).toEqual({
      fetchPendingFeedbackReservations: expect.any(Function),
      fetchSingleReservationFeedback: expect.any(Function),
    });
    expect(feedbackSessionCoordinator).toBeDefined();

    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: {
        '302': {
          viewerRole: 'mentor',
          reservation: makeReservation('302', 1761000000, {
            viewerRole: 'MENTOR',
          }),
        },
      },
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    // Unauthenticated visitors get sign-in callback URL without hitting lookup
    const unauth = await coordinator.resolveHistoryRedirect({
      authStatus: 'unauthenticated',
      userId: '',
      fallbackRole: 'mentee',
      rawSearch: 'reservation_id=302&feedback=queue',
    });
    expect(unauth).toEqual({
      redirectHref:
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D302%26feedback%3Dqueue',
      resolvedRole: 'mentee',
      seeded: null,
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(0);

    // Unauthenticated + feedback disabled (#913) strips feedback query params from callbackUrl
    const unauthDisabled = await coordinator.resolveHistoryRedirect({
      authStatus: 'unauthenticated',
      userId: '',
      fallbackRole: 'mentee',
      rawSearch: 'reservation_id=302&feedback=queue&utm_source=email',
      feedbackEnabled: false,
    });
    expect(unauthDisabled).toEqual({
      redirectHref:
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Futm_source%3Demail',
      resolvedRole: 'mentee',
      seeded: null,
    });

    // Authenticated resolves via wired lookup port without per-call lookupSingleFeedback injection
    const resolved = await coordinator.resolveHistoryRedirect({
      userId: '20',
      fallbackRole: 'mentee',
      rawSearch: 'reservation_id=302',
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
    expect(resolved.redirectHref).toBe(
      '/reservation/mentor?tab=history&reservation_id=302'
    );
    expect(resolved.resolvedRole).toBe('mentor');
  });

  it('reconcileLoginSession atomically handles session eligibility, single-flight queue fetch, mid-flight suppression abort, auth resets, and #913 disabled short-circuit', async () => {
    const storage = createInMemoryFeedbackSessionStoragePort();
    let resolvePendingFetch: ((items: Reservation[]) => void) | undefined;
    const lookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: () =>
        new Promise<Reservation[]>((resolve) => {
          resolvePendingFetch = resolve;
        }),
    });
    const coordinator = createFeedbackSessionCoordinator({ storage, lookup });

    // 1. Disabled feature flag (#913) short-circuits immediately
    const disabledRes = await coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
      feedbackEnabled: false,
    });
    expect(disabledRes).toEqual({
      queueItems: null,
      canPresent: false,
      isSuppressed: true,
      promptShownCount: null,
    });
    expect(lookup.calls.fetchPendingFeedbackReservations).toHaveLength(0);

    // 2. Unresolved isMentor (undefined), incomplete onboarding, or session error suppresses fetch
    await coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: undefined,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });
    await coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: false,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });
    await coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: true,
      hasSessionError: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });
    expect(lookup.calls.fetchPendingFeedbackReservations).toHaveLength(0);

    // 3. Single-flight deduplication across concurrent eligible SPA route transitions (/mentor-pool -> /about)
    const p1 = coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });
    const p2 = coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: true,
      route: { pathname: '/about', searchParams: new URLSearchParams() },
    });
    expect(lookup.calls.fetchPendingFeedbackReservations).toHaveLength(1);

    resolvePendingFetch?.([
      makeReservation('q-2', 1762000000, { viewerRole: undefined }),
      makeReservation('q-1', 1760000000, { viewerRole: 'MENTEE' }),
    ]);

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.queueItems?.map((i) => i.id)).toEqual(['q-1', 'q-2']);
    expect(res1.queueItems?.[1]?.viewerRole).toBe('MENTOR');
    // Prompt-shown count is consumed once across concurrent callers
    const shownCounts = [res1.promptShownCount, res2.promptShownCount].filter(
      (n) => n !== null
    );
    expect(shownCounts).toEqual([2]);

    // 4. Auth reset route (/auth/signin) even during status === 'loading' wipes session state
    const resetRes = await coordinator.reconcileLoginSession({
      authStatus: 'loading',
      userId: 'u-1',
      isMentor: true,
      isOnboardingComplete: true,
      route: { pathname: '/auth/signin', searchParams: new URLSearchParams() },
    });
    expect(resetRes.queueItems).toBeNull();
    expect(coordinator.getSessionState('u-1').checked).toBe(false);

    // 5. Navigating to a suppressed route mid-flight aborts the in-flight request without poisoning checked=true
    let midFlightSignal: AbortSignal | undefined;
    let resolveMidFlight: ((items: Reservation[]) => void) | undefined;
    const abortableLookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: ({ signal }) => {
        midFlightSignal = signal;
        return new Promise<Reservation[]>((resolve) => {
          resolveMidFlight = resolve;
        });
      },
    });
    const coordinator2 = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: abortableLookup,
    });

    const inFlightPromise = coordinator2.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-2',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });

    // User navigates to /reservation/mentee before fetch resolves -> aborts in-flight fetch
    await coordinator2.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-2',
      isMentor: false,
      isOnboardingComplete: true,
      route: {
        pathname: '/reservation/mentee',
        searchParams: new URLSearchParams('tab=history'),
      },
    });
    expect(midFlightSignal?.aborted).toBe(true);

    resolveMidFlight?.([makeReservation('stale-1', 1760000000)]);
    const abortedOutcome = await inFlightPromise;
    expect(abortedOutcome.queueItems).toBeNull();
    expect(coordinator2.getSessionState('u-2').checked).toBe(false);
  });
});

describe('FeedbackSessionCoordinator core APIs — History Route & Outcomes (#944)', () => {
  it('handles cross-role deep-link seed transfer across both pre-seeded redirects and single-item fallback lookups with zero redundant HTTP calls', async () => {
    const mentorCard = makeReservation('889', 1761000000, {
      viewerRole: 'MENTOR',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: {
        '889': {
          viewerRole: 'mentor',
          reservation: mentorCard,
        },
      },
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    // 1. User lands directly on /reservation/mentee?tab=history&reservation_id=889
    const initialStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '20',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=889',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    expect(initialStep.state.isLookingUpSingleReservation).toBe(true);
    expect(initialStep.pendingLookup).not.toBeNull();

    const lookupSettled = await initialStep.pendingLookup!;
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
    expect(lookupSettled.commands).toEqual({
      replaceHref: '/reservation/mentor?tab=history&reservation_id=889',
      toast: null,
      shouldLoadMoreHistory: false,
    });

    // /reservation/mentee unmounts -> resetHistoryRouteSession preserves cross-role seed
    coordinator.resetHistoryRouteSession();

    // 2. /reservation/mentor mounts and consumes re-seeded lookup synchronously with 0 extra HTTP calls
    const mentorStep = coordinator.reconcileHistoryRoute({
      role: 'mentor',
      userId: '20',
      pathname: '/reservation/mentor',
      rawSearch: 'tab=history&reservation_id=889',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
    expect(mentorStep.commands.shouldLoadMoreHistory).toBe(false);
    expect(mentorStep.state.deepLinkDialogReservation).toBe(mentorCard);
    expect(mentorStep.state.highlightedReservationId).toBe('889');

    // 3. Pre-seeded lookup on wrong role tab ALSO re-seeds and redirects without hitting HTTP
    coordinator.seedLookupResult({
      userId: '20',
      reservationId: '890',
      result: {
        viewerRole: 'mentee',
        reservation: makeReservation('890', 1762000000),
      },
    });
    const wrongRoleSeeded = coordinator.reconcileHistoryRoute({
      role: 'mentor',
      userId: '20',
      pathname: '/reservation/mentor',
      rawSearch: 'tab=history&reservation_id=890',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
    });
    expect(wrongRoleSeeded.commands.replaceHref).toBe(
      '/reservation/mentee?tab=history&reservation_id=890'
    );
    const rightRoleSeeded = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '20',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=890',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
    });
    expect(rightRoleSeeded.state.deepLinkDialogReservation?.id).toBe('890');
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
  });

  it('auto-paginates history up to MAX_DEEP_LINK_LOAD_MORE_PAGES (3 pages) before falling back to single lookup or not-found toast', async () => {
    expect(MAX_DEEP_LINK_LOAD_MORE_PAGES).toBe(3);

    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: { '999': null },
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    const p0 = makeReservation('301', 1760000000);
    const p1 = makeReservation('302', 1761000000);
    const p2 = makeReservation('303', 1762000000);
    const p3 = makeReservation('304', 1763000000);

    // Page 0 -> triggers loadMore #1
    const s1 = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=999',
      history: [p0],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(s1.commands.shouldLoadMoreHistory).toBe(true);
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(0);

    // Duplicate call with unchanged history length does NOT double-increment autoLoadCount
    const s1Dup = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=999',
      history: [p0],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(s1Dup.commands.shouldLoadMoreHistory).toBe(false);

    // Page 1 -> triggers loadMore #2
    const s2 = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=999',
      history: [p0, p1],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(s2.commands.shouldLoadMoreHistory).toBe(true);

    // Page 2 -> triggers loadMore #3
    const s3 = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=999',
      history: [p0, p1, p2],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(s3.commands.shouldLoadMoreHistory).toBe(true);

    // Page 3 (after 3 auto-loads) -> stops paginating and falls back to single lookup -> 404 not-found toast & URL strip
    const s4 = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=999',
      history: [p0, p1, p2, p3],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
    });
    expect(s4.commands.shouldLoadMoreHistory).toBe(false);
    expect(s4.pendingLookup).not.toBeNull();

    const settled404 = await s4.pendingLookup!;
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(1);
    expect(settled404.commands).toEqual({
      replaceHref: '/reservation/mentee?tab=history',
      toast: {
        kind: 'not-found',
        title: '找不到指定的會談紀錄',
        description: '請確認您登入的帳號是否正確，或於歷史紀錄列表查看。',
      },
      shouldLoadMoreHistory: false,
    });
  });

  it('cancels in-flight single-reservation lookup on mid-flight route navigation or AbortSignal without emitting stale toasts or redirects', async () => {
    const capturedSignals: AbortSignal[] = [];
    const resolvers: Array<(val: null) => void> = [];
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: ({ signal }) => {
        if (signal) capturedSignals.push(signal);
        return new Promise<null>((resolve) => {
          resolvers.push(resolve);
        });
      },
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    // 1. Mid-flight navigation away from deep-link param aborts lookup
    const first = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=701',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    expect(capturedSignals[0]?.aborted).toBe(false);

    // User navigates away (query cleared) before lookup settles
    coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    expect(capturedSignals[0]?.aborted).toBe(true);

    resolvers[0]?.(null);
    const firstSettled = await first.pendingLookup!;
    expect(firstSettled.aborted).toBe(true);
    expect(firstSettled.commands.toast).toBeNull();
    expect(firstSettled.commands.replaceHref).toBeNull();

    // 2. External AbortSignal cancellation
    const externalController = new AbortController();
    const second = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: '10',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=702',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
      signal: externalController.signal,
    });
    externalController.abort();
    expect(capturedSignals[1]?.aborted).toBe(true);

    resolvers[1]?.(null);
    const secondSettled = await second.pendingLookup!;
    expect(secondSettled.aborted).toBe(true);
    expect(secondSettled.commands.toast).toBeNull();
  });

  it('arbitrates priority between deep-link reservation_id and ?feedback=queue and advances cleanly via recordFeedbackOutcome', () => {
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
    });

    const item101 = makeReservation('101', 1760000000);
    const item102 = makeReservation('102', 1761000000);

    // Both reservation_id=101 and feedback=queue present -> deep-link wins, queue suppressed
    const step1 = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=101&feedback=queue',
      history: [item101, item102],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(step1.state.hasDeepLinkTarget).toBe(true);
    expect(step1.state.isFeedbackQueueRequested).toBe(true);
    expect(step1.state.deepLinkDialogReservation).toBe(item101);
    expect(step1.state.feedbackQueueItems).toBeNull();
    expect(step1.commands.replaceHref).toBeNull();

    // Reference-stable snapshot when nothing changes
    const snapA = coordinator.getHistoryRouteState();
    const snapB = coordinator.getHistoryRouteState();
    expect(snapA).toBe(snapB);

    // User submits item101 -> history updates in-place BEFORE URL sync completes; must NOT fire already-rated toast
    coordinator.recordFeedbackOutcome({
      action: 'submit',
      source: 'deep-link',
      userId: 'u-1',
      reservationId: '101',
    });
    const rated101 = makeReservation('101', 1760000000, {
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 9,
          content: 'Great!',
          createdAt: 1760000100,
          updatedAt: 1760000100,
          authorName: 'U***',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    const stepDuringSubmit = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=101&feedback=queue',
      history: [rated101, item102],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(stepDuringSubmit.commands.toast).toBeNull();

    // Closing deep-link dialog strips reservation_id=101 while preserving feedback=queue
    const closeDeepLink = coordinator.recordFeedbackOutcome({
      action: 'close',
      source: 'deep-link',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=101&feedback=queue',
    });
    expect(closeDeepLink.replaceHref).toBe(
      '/reservation/mentee?tab=history&feedback=queue'
    );

    // Next reconcile on ?tab=history&feedback=queue latches ONLY remaining item102 (excluding submitted 101)
    const queueStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&feedback=queue',
      history: [rated101, item102],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(queueStep.state.deepLinkDialogReservation).toBeNull();
    expect(queueStep.state.feedbackQueueItems).toEqual([item102]);

    // Background refetch emptying history keeps latched queue intact until explicit close
    const bgRefetchStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&feedback=queue',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(bgRefetchStep.state.feedbackQueueItems).toEqual([item102]);
    expect(bgRefetchStep.commands.replaceHref).toBeNull();

    // Defer / close explicit queue cleans URL and resets latched queue
    const closeQueue = coordinator.recordFeedbackOutcome({
      action: 'defer',
      source: 'explicit-queue',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&feedback=queue',
    });
    expect(closeQueue.replaceHref).toBe('/reservation/mentee?tab=history');
    expect(coordinator.getHistoryRouteState().feedbackQueueItems).toBeNull();
  });

  it('covers already-rated/cancelled/resolved toasts, focus persistence & clear-focus, login-queue outcomes, and #913 disabled short-circuit', async () => {
    const lookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: [
        makeReservation('l-1', 1760000000),
        makeReservation('l-2', 1761000000),
      ],
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    const ratedCard = makeReservation('501', 1760000000, {
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 10,
          content: '收穫良多',
          createdAt: 1760000100,
          updatedAt: 1760000100,
          authorName: 'J***',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    const cancelledCard = makeReservation('502', 1761000000, {
      cancelledBy: 'MENTOR',
    });

    expect(
      resolveDeepLinkOutcome({
        role: 'mentee',
        targetReservationId: '501',
        history: [ratedCard],
      }).kind
    ).toBe('mentee-already-rated');

    const ratedStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=501',
      history: [ratedCard, cancelledCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(ratedStep.state.highlightedReservationId).toBe('501');
    expect(ratedStep.state.autoExpandedReservationId).toBe('501');
    expect(ratedStep.state.deepLinkTriggerSeq).toBe(1);
    expect(ratedStep.commands.toast?.kind).toBe('already-rated');
    expect(ratedStep.commands.replaceHref).toBe(
      '/reservation/mentee?tab=history'
    );

    // Stripped URL preserves focus on current history tab
    const afterStrip = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history',
      history: [ratedCard, cancelledCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(afterStrip.state.highlightedReservationId).toBe('501');
    expect(afterStrip.state.autoExpandedReservationId).toBe('501');

    // Cancelled deep link clears stale auto-expand and emits cancelled toast
    const cancelledStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservationId=502',
      history: [ratedCard, cancelledCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(cancelledStep.state.highlightedReservationId).toBe('502');
    expect(cancelledStep.state.autoExpandedReservationId).toBeNull();
    expect(cancelledStep.state.deepLinkTriggerSeq).toBe(2);
    expect(cancelledStep.commands.toast?.kind).toBe('cancelled');

    // clear-focus clears highlight and auto-expand
    coordinator.recordFeedbackOutcome({ action: 'clear-focus' });
    expect(
      coordinator.getHistoryRouteState().highlightedReservationId
    ).toBeNull();

    // Login queue outcome lifecycle via recordFeedbackOutcome
    await coordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-1',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
    });
    coordinator.recordFeedbackOutcome({
      action: 'submit',
      source: 'login-queue',
      userId: 'u-1',
      reservationId: 'l-1',
    });
    coordinator.recordFeedbackOutcome({
      action: 'skip',
      source: 'login-queue',
      userId: 'u-1',
      reservationId: 'l-2',
    });
    const dismissedLogin = coordinator.recordFeedbackOutcome({
      action: 'dismiss',
      source: 'login-queue',
      userId: 'u-1',
    });
    expect(dismissedLogin.dismissedSkippedCount).toBe(1);

    // #913 feedbackEnabled === false short-circuits reconcileHistoryRoute & recordFeedbackOutcome
    const disabledStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=999&feedback=queue',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: true,
      canLoadMoreHistory: true,
      feedbackEnabled: false,
    });
    expect(disabledStep.state).toEqual({
      hasDeepLinkTarget: false,
      isFeedbackQueueRequested: false,
      deepLinkDialogReservation: null,
      feedbackQueueItems: null,
      highlightedReservationId: null,
      autoExpandedReservationId: null,
      deepLinkTriggerSeq: 0,
      isLookingUpSingleReservation: false,
    });
    expect(disabledStep.commands).toEqual({
      replaceHref: null,
      toast: null,
      shouldLoadMoreHistory: false,
    });
    expect(lookup.calls.fetchSingleReservationFeedback).toHaveLength(0);
  });

  it('supports dual mode ("deep-link" + "queue") adapter coexistence, upcoming+pending readiness gate, mentor-locate-card, and 500 lookup rejection fallback', async () => {
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: () => Promise.reject(new Error('500 Upstream Error')),
    });
    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup,
    });

    // 1. Empty ?feedback=queue waits while BOTH upcoming & pending are still loading, then strips param once ready
    const waitingQueue = coordinator.reconcileHistoryRoute({
      mode: 'queue',
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=upcoming&feedback=queue',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      isLoadingUpcoming: true,
      isLoadingPending: true,
    });
    expect(waitingQueue.commands.replaceHref).toBeNull();

    const readyEmptyQueue = coordinator.reconcileHistoryRoute({
      mode: 'queue',
      role: 'mentee',
      userId: 'u-1',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=upcoming&feedback=queue',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      isLoadingUpcoming: false,
      isLoadingPending: true,
    });
    expect(readyEmptyQueue.commands.replaceHref).toBe(
      '/reservation/mentee?tab=upcoming'
    );

    // 2. Mentor answered card locates & expands feedback block without opening dialog
    const mentorAnsweredWithRating = makeReservation('601', 1760000000, {
      viewerRole: 'MENTOR',
      feedback: {
        meetingHappened: true,
        myMeetingHappened: true,
        rating: null,
        nextStep: null,
      },
    });
    const mentorLocate = coordinator.reconcileHistoryRoute({
      mode: 'deep-link',
      role: 'mentor',
      userId: 'u-1',
      pathname: '/reservation/mentor',
      rawSearch: 'tab=history&reservationId=601',
      history: [mentorAnsweredWithRating],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(mentorLocate.state.deepLinkDialogReservation).toBeNull();
    expect(mentorLocate.state.highlightedReservationId).toBe('601');
    expect(mentorLocate.state.autoExpandedReservationId).toBe('601');
    expect(mentorLocate.commands.toast).toBeNull();
    expect(mentorLocate.commands.replaceHref).toBe(
      '/reservation/mentor?tab=history'
    );

    // 3. Single-reservation 500 rejection gracefully emits not-found toast & cleans query
    const failingStep = coordinator.reconcileHistoryRoute({
      mode: 'deep-link',
      role: 'mentor',
      userId: 'u-1',
      pathname: '/reservation/mentor',
      rawSearch: 'tab=history&reservation_id=500',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    const settled500 = await failingStep.pendingLookup!;
    expect(settled500.commands.toast?.kind).toBe('not-found');
    expect(settled500.commands.replaceHref).toBe(
      '/reservation/mentor?tab=history'
    );
  });

  it('isolates single-flight AbortSignal subscribers across pre-aborted, single-abort, shared-abort, and unexpected fetchPending/onError failures', async () => {
    // (a) Pre-aborted AbortSignal makes 0 fetch calls and leaves checked === false
    const preAbortedLookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: [makeReservation('pre-1', 1760000000)],
    });
    const preAbortedCoordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: preAbortedLookup,
    });
    const preAbortedController = new AbortController();
    preAbortedController.abort();

    const preAbortedRes = await preAbortedCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-pre',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
      signal: preAbortedController.signal,
    });
    expect(
      preAbortedLookup.calls.fetchPendingFeedbackReservations
    ).toHaveLength(0);
    expect(preAbortedCoordinator.getSessionState('u-pre').checked).toBe(false);
    expect(preAbortedRes).toEqual({
      queueItems: null,
      canPresent: false,
      isSuppressed: false,
      promptShownCount: null,
    });

    // (b) Single caller mid-flight signal.abort() aborts underlying request, cleans up listener, and leaves checked === false
    let singleCapturedSignal: AbortSignal | undefined;
    let resolveSingleFetch: ((items: Reservation[]) => void) | undefined;
    const singleAbortLookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: ({ signal }) => {
        singleCapturedSignal = signal;
        return new Promise<Reservation[]>((resolve) => {
          resolveSingleFetch = resolve;
        });
      },
    });
    const singleAbortCoordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: singleAbortLookup,
    });
    const singleController = new AbortController();
    const removeSingleListenerSpy = vi.spyOn(
      singleController.signal,
      'removeEventListener'
    );

    const singlePromise = singleAbortCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-single',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
      signal: singleController.signal,
    });
    expect(singleCapturedSignal?.aborted).toBe(false);

    singleController.abort();
    expect(singleCapturedSignal?.aborted).toBe(true);

    resolveSingleFetch?.([makeReservation('single-1', 1760000000)]);
    const singleRes = await singlePromise;
    expect(singleRes).toEqual({
      queueItems: null,
      canPresent: false,
      isSuppressed: false,
      promptShownCount: null,
    });
    expect(singleAbortCoordinator.getSessionState('u-single').checked).toBe(
      false
    );
    expect(removeSingleListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    );

    // (c) Two concurrent callers sharing single-flight: Caller 1 aborts mid-flight while Caller 2 stays active
    let sharedCapturedSignal: AbortSignal | undefined;
    let resolveSharedFetch: ((items: Reservation[]) => void) | undefined;
    const sharedLookup = createInMemoryFeedbackSessionLookupPort({
      pendingReservations: ({ signal }) => {
        sharedCapturedSignal = signal;
        return new Promise<Reservation[]>((resolve) => {
          resolveSharedFetch = resolve;
        });
      },
    });
    const sharedCoordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
      lookup: sharedLookup,
    });

    const caller1Controller = new AbortController();
    const caller2Controller = new AbortController();
    const removeCaller1Spy = vi.spyOn(
      caller1Controller.signal,
      'removeEventListener'
    );
    const removeCaller2Spy = vi.spyOn(
      caller2Controller.signal,
      'removeEventListener'
    );

    const caller1Promise = sharedCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-shared',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
      signal: caller1Controller.signal,
    });
    const caller2Promise = sharedCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-shared',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/about', searchParams: new URLSearchParams() },
      signal: caller2Controller.signal,
    });

    expect(sharedLookup.calls.fetchPendingFeedbackReservations).toHaveLength(1);

    // Caller 1 aborts (e.g. SPA route cleanup from /mentor-pool -> /about) while Caller 2 remains active
    caller1Controller.abort();
    expect(sharedCapturedSignal?.aborted).toBe(false);

    resolveSharedFetch?.([
      makeReservation('sf-1', 1760000000),
      makeReservation('sf-2', 1761000000),
    ]);

    const [caller1Res, caller2Res] = await Promise.all([
      caller1Promise,
      caller2Promise,
    ]);

    expect(caller1Res).toEqual({
      queueItems: null,
      canPresent: false,
      isSuppressed: false,
      promptShownCount: null,
    });
    expect(caller2Res.canPresent).toBe(true);
    expect(caller2Res.isSuppressed).toBe(false);
    expect(caller2Res.queueItems?.map((item) => item.id)).toEqual([
      'sf-1',
      'sf-2',
    ]);
    expect(caller2Res.promptShownCount).toBe(2);
    expect(removeCaller1Spy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    );
    expect(removeCaller2Spy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    );

    // Also verify when ALL concurrent subscribers abort, the shared request aborts once subscribers.size === 0
    const both1 = new AbortController();
    const both2 = new AbortController();
    const bothP1 = sharedCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-both-abort',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/mentor-pool', searchParams: new URLSearchParams() },
      signal: both1.signal,
    });
    const bothP2 = sharedCoordinator.reconcileLoginSession({
      authStatus: 'authenticated',
      userId: 'u-both-abort',
      isMentor: false,
      isOnboardingComplete: true,
      route: { pathname: '/about', searchParams: new URLSearchParams() },
      signal: both2.signal,
    });
    both1.abort();
    expect(sharedCapturedSignal?.aborted).toBe(false);
    both2.abort();
    expect(sharedCapturedSignal?.aborted).toBe(true);
    resolveSharedFetch?.([makeReservation('sf-3', 1762000000)]);
    const [bothRes1, bothRes2] = await Promise.all([bothP1, bothP2]);
    expect(bothRes1.canPresent).toBe(false);
    expect(bothRes2.canPresent).toBe(false);
    expect(sharedCoordinator.getSessionState('u-both-abort').checked).toBe(
      false
    );

    // (d) Unexpected fetchPending rejection & throwing onError never reject unhandled or leak raw userId to Sentry
    const captureSpy = vi
      .spyOn(monitoring, 'captureFlowFailure')
      .mockResolvedValue();
    try {
      const defaultErrorCoordinator = createFeedbackSessionCoordinator({
        storage: createInMemoryFeedbackSessionStoragePort(),
      });
      const sensitiveUserId = 'user-pii-998877';
      const rejectedRes = await defaultErrorCoordinator.reconcileLoginSession({
        authStatus: 'authenticated',
        userId: sensitiveUserId,
        isMentor: true,
        isOnboardingComplete: true,
        route: {
          pathname: '/mentor-pool',
          searchParams: new URLSearchParams(),
        },
        fetchPending: () =>
          Promise.reject(new Error('502 Upstream Bad Gateway')),
      });
      expect(rejectedRes).toEqual({
        queueItems: null,
        canPresent: false,
        isSuppressed: false,
        promptShownCount: null,
      });
      expect(
        defaultErrorCoordinator.getSessionState(sensitiveUserId).checked
      ).toBe(false);
      expect(captureSpy).toHaveBeenCalledTimes(1);
      const sentryPayload = captureSpy.mock.calls[0]?.[0];
      expect(sentryPayload).toEqual({
        flow: 'pending_feedback_queue',
        step: 'load_login_queue',
        message: '502 Upstream Bad Gateway',
        level: 'warning',
      });
      expect(JSON.stringify(sentryPayload)).not.toContain(sensitiveUserId);

      // Even if a custom onError throws synchronously, reconcileLoginSession still resolves gracefully
      const throwingOnErrorCoordinator = createFeedbackSessionCoordinator({
        storage: createInMemoryFeedbackSessionStoragePort(),
        onError: () => {
          throw new Error('custom onError exploded');
        },
      });
      const syncThrowRes =
        await throwingOnErrorCoordinator.reconcileLoginSession({
          authStatus: 'authenticated',
          userId: sensitiveUserId,
          isMentor: false,
          isOnboardingComplete: true,
          route: {
            pathname: '/mentor-pool',
            searchParams: new URLSearchParams(),
          },
          fetchPending: () => {
            throw new Error('Synchronous fetchPending crash');
          },
        });
      expect(syncThrowRes).toEqual({
        queueItems: null,
        canPresent: false,
        isSuppressed: false,
        promptShownCount: null,
      });
      expect(captureSpy).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(captureSpy.mock.calls[1]?.[0])).not.toContain(
        sensitiveUserId
      );
    } finally {
      captureSpy.mockRestore();
    }
  });

  it('notifies subscribe(listener) across sync/async history transitions, outcomes, resets, idempotent repeats, and empty-storage logout', async () => {
    const resolvers: Array<
      (res: { viewerRole: 'mentee'; reservation: Reservation } | null) => void
    > = [];
    const lookup = createInMemoryFeedbackSessionLookupPort({
      singleReservations: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    });
    const storage = createInMemoryFeedbackSessionStoragePort();
    const coordinator = createFeedbackSessionCoordinator({
      storage,
      lookup,
    });

    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);

    const openCard = makeReservation('801', 1760000000);
    const queueCard = makeReservation('802', 1761000000);

    // (a.1) Sync reconcileHistoryRoute transition fires listener once
    const syncStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=801',
      history: [openCard, queueCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(syncStep.state.deepLinkDialogReservation).toBe(openCard);
    expect(listener).toHaveBeenCalledTimes(1);

    // (b) Idempotent repeat reconcileHistoryRoute fires 0 extra listener calls
    listener.mockClear();
    const repeatStep = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=801',
      history: [openCard, queueCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(repeatStep.state).toBe(syncStep.state);
    expect(listener).toHaveBeenCalledTimes(0);

    // (a.2) recordFeedbackOutcome('deep-link') closes dialog and notifies listener
    listener.mockClear();
    coordinator.recordFeedbackOutcome({
      action: 'close',
      source: 'deep-link',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=801',
    });
    expect(
      coordinator.getHistoryRouteState().deepLinkDialogReservation
    ).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    // (a.3) recordFeedbackOutcome('clear-focus') clears highlight and notifies listener
    listener.mockClear();
    coordinator.recordFeedbackOutcome({ action: 'clear-focus' });
    expect(
      coordinator.getHistoryRouteState().highlightedReservationId
    ).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    // (a.4) Explicit queue latch + recordFeedbackOutcome('explicit-queue') notifies listener
    listener.mockClear();
    coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&feedback=queue',
      history: [queueCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(coordinator.getHistoryRouteState().feedbackQueueItems).toEqual([
      queueCard,
    ]);
    expect(listener).toHaveBeenCalledTimes(1);

    listener.mockClear();
    coordinator.recordFeedbackOutcome({
      action: 'dismiss',
      source: 'explicit-queue',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&feedback=queue',
    });
    expect(coordinator.getHistoryRouteState().feedbackQueueItems).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    // (a.5) Async pendingLookup completion notifies on start and on completion
    listener.mockClear();
    const asyncLookupStart = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=901',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    expect(asyncLookupStart.state.isLookingUpSingleReservation).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Idempotent repeat while lookup is in-flight fires 0 extra listener calls
    listener.mockClear();
    const inFlightRepeat = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=901',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
    });
    expect(inFlightRepeat.pendingLookup).toBe(asyncLookupStart.pendingLookup);
    expect(listener).toHaveBeenCalledTimes(0);

    resolvers[0]?.({
      viewerRole: 'mentee',
      reservation: makeReservation('901', 1762000000),
    });
    await asyncLookupStart.pendingLookup!;
    expect(
      coordinator.getHistoryRouteState().isLookingUpSingleReservation
    ).toBe(false);
    expect(
      coordinator.getHistoryRouteState().deepLinkDialogReservation?.id
    ).toBe('901');
    expect(listener).toHaveBeenCalledTimes(1);

    // (a.6) Async pendingLookup cancellation notifies when aborted lookup settles
    listener.mockClear();
    const abortController = new AbortController();
    const cancelledLookupStart = coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=902',
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      hasMoreHistory: false,
      signal: abortController.signal,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    listener.mockClear();
    abortController.abort();
    resolvers[1]?.(null);
    const cancelledStep = await cancelledLookupStart.pendingLookup!;
    expect(cancelledStep.aborted).toBe(true);
    expect(
      coordinator.getHistoryRouteState().isLookingUpSingleReservation
    ).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    // (a.7) resetHistoryRouteSession notifies when non-default, 0 times when already default
    listener.mockClear();
    coordinator.resetHistoryRouteSession();
    expect(listener).toHaveBeenCalledTimes(1);
    listener.mockClear();
    coordinator.resetHistoryRouteSession();
    expect(listener).toHaveBeenCalledTimes(0);

    // (c) clearAllSessionState() & logout reset when storage is completely empty while getHistoryRouteState() was non-default
    expect(storage.keys()).toEqual([]);
    const ratedCard = makeReservation('903', 1763000000, {
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 10,
          content: 'Solid',
          createdAt: 1763000100,
          updatedAt: 1763000100,
          authorName: 'A***',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=903',
      history: [ratedCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(storage.keys()).toEqual([]);
    expect(coordinator.getHistoryRouteState().highlightedReservationId).toBe(
      '903'
    );

    listener.mockClear();
    coordinator.clearAllSessionState();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(coordinator.getHistoryRouteState()).toEqual({
      hasDeepLinkTarget: false,
      isFeedbackQueueRequested: false,
      deepLinkDialogReservation: null,
      feedbackQueueItems: null,
      highlightedReservationId: null,
      autoExpandedReservationId: null,
      deepLinkTriggerSeq: 0,
      isLookingUpSingleReservation: false,
    });

    // Repeat via logout / auth reset route while storage is empty and history state is non-default
    coordinator.reconcileHistoryRoute({
      role: 'mentee',
      userId: 'u-sub',
      pathname: '/reservation/mentee',
      rawSearch: 'tab=history&reservation_id=903',
      history: [ratedCard],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });
    expect(storage.keys()).toEqual([]);
    expect(coordinator.getHistoryRouteState().highlightedReservationId).toBe(
      '903'
    );

    listener.mockClear();
    await coordinator.reconcileLoginSession({
      authStatus: 'unauthenticated',
      userId: '',
      route: { pathname: '/auth/signin', searchParams: new URLSearchParams() },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(coordinator.getHistoryRouteState()).toEqual({
      hasDeepLinkTarget: false,
      isFeedbackQueueRequested: false,
      deepLinkDialogReservation: null,
      feedbackQueueItems: null,
      highlightedReservationId: null,
      autoExpandedReservationId: null,
      deepLinkTriggerSeq: 0,
      isLookingUpSingleReservation: false,
    });

    unsubscribe();
    listener.mockClear();
    coordinator.clearAllSessionState();
    expect(listener).toHaveBeenCalledTimes(0);
  });
});

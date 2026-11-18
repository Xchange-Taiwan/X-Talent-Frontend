import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import type { MentorType } from '@/types/mentor';

import {
  createFavoriteMentorsReadModel,
  type PendingFavoriteStoragePort,
} from './favoriteMentorsReadModel';

function makeMentor(userId: number, name = `Mentor ${userId}`): MentorType {
  return fromPartial<MentorType>({
    user_id: userId,
    name,
    avatar: '/avatars/default_1.webp',
    job_title: 'Staff Engineer',
    company: 'XChange',
    have_topic: ['career_planning'],
    have_skill: ['system_design'],
  });
}

function createInMemoryPendingStorage(): PendingFavoriteStoragePort & {
  peekRaw(): number | null;
} {
  let storedId: number | null = null;
  return {
    savePending(mentorId: number) {
      storedId = mentorId;
    },
    getPendingMentorId() {
      return storedId;
    },
    clearPending() {
      storedId = null;
    },
    peekRaw() {
      return storedId;
    },
  };
}

describe('createFavoriteMentorsReadModel (#908)', () => {
  it('propagates AbortSignal across GET/PUT/DELETE and aborts in-flight requests on account switch or clear()', async () => {
    let getSignal: AbortSignal | undefined;
    let putSignal: AbortSignal | undefined;
    let resolveGetUser1!: (items: MentorType[]) => void;
    let resolvePutUser1!: () => void;

    const fetchMock = vi
      .fn()
      .mockImplementation((_userId: string, signal?: AbortSignal) => {
        if (!getSignal) {
          getSignal = signal;
          return new Promise<MentorType[]>((resolve) => {
            resolveGetUser1 = resolve;
          });
        }
        return Promise.resolve([makeMentor(202)]);
      });

    const addMock = vi
      .fn()
      .mockImplementation(
        (_userId: string, _id: number, signal?: AbortSignal) => {
          putSignal = signal;
          return new Promise<void>((resolve) => {
            resolvePutUser1 = resolve;
          });
        }
      );

    const trackAnalytics = vi.fn();
    const model = createFavoriteMentorsReadModel({
      transport: {
        fetchFavoriteMentors: fetchMock,
        addFavoriteMentor: addMock,
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics,
    });

    const unsub1 = model.subscribe('user-1', () => {});
    const toggleUser1 = model.toggle({
      userId: 'user-1',
      mentorId: 101,
      mentorSnapshot: makeMentor(101),
      feature: 'mentor_pool',
    });

    expect(model.getMentorState('user-1', 101)).toEqual({
      isFavorited: true,
      isPending: true,
      isSelf: false,
    });

    // Switching to user-2 aborts both user-1 GET and PUT signals immediately
    const updatesUser2: Array<number[]> = [];
    const unsub2 = model.subscribe('user-2', () => {
      const snap = model.getSnapshot('user-2');
      if (snap) {
        updatesUser2.push(snap.mentors.map((m) => m.user_id));
      }
    });

    expect(getSignal?.aborted).toBe(true);
    expect(putSignal?.aborted).toBe(true);
    expect(model.getMentorState('user-1', 101).isPending).toBe(false);

    resolveGetUser1([makeMentor(999)]);
    resolvePutUser1();
    const outcome = await toggleUser1;
    expect(outcome.status).toBe('aborted');
    expect(trackAnalytics).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(updatesUser2).toContainEqual([202]);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'user-1',
      expect.any(AbortSignal)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'user-2',
      expect.any(AbortSignal)
    );
    expect(addMock).toHaveBeenCalledWith(
      'user-1',
      101,
      expect.any(AbortSignal)
    );

    unsub1();
    unsub2();
    model.clear();
    expect(model.getSnapshot('user-2')).toBeUndefined();
  });

  it('triggers background refresh instead of inserting blank placeholder cards when mentorSnapshot is omitted, and emits analytics only after settlement', async () => {
    let fetchCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      fetchCount += 1;
      return fetchCount === 1 ? [] : [makeMentor(303, 'Hydrated From Server')];
    });
    let resolvePut!: () => void;
    const addMock = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePut = resolve;
        })
    );
    const trackAnalytics = vi.fn();

    const model = createFavoriteMentorsReadModel({
      transport: {
        fetchFavoriteMentors: fetchMock,
        addFavoriteMentor: addMock,
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics,
    });

    const snapshots: MentorType[][] = [];
    model.subscribe('user-1', () => {
      const snap = model.getSnapshot('user-1');
      if (snap) snapshots.push(snap.mentors);
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const togglePromise = model.toggle({
      userId: 'user-1',
      mentorId: 303,
      feature: 'profile',
    });

    // Optimistic bookmark state flips immediately, NO blank placeholder card, NO premature analytics
    expect(model.getMentorState('user-1', 303).isFavorited).toBe(true);
    expect(model.getSnapshot('user-1')?.mentors).toEqual([]);
    expect(trackAnalytics).not.toHaveBeenCalled();

    resolvePut();
    const outcome = await togglePromise;
    expect(outcome).toEqual({ status: 'added', nextFavorited: true });
    expect(trackAnalytics).toHaveBeenCalledOnce();
    expect(trackAnalytics).toHaveBeenCalledWith({
      name: 'mentor_bookmark_toggle',
      feature: 'profile',
      metadata: { mentor_id: 303, action: 'add' },
    });

    await vi.waitFor(() => {
      expect(model.getSnapshot('user-1')?.mentors[0]?.name).toBe(
        'Hydrated From Server'
      );
    });
  });

  it('handles guest redirect via getSignInUrl, enforces self-bookmark rejection, and clears pending storage only after confirmed replay settlement', async () => {
    const storage = createInMemoryPendingStorage();
    let resolveReplayPut!: () => void;
    const addMock = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveReplayPut = resolve;
        })
    );
    const trackAnalytics = vi.fn();

    const model = createFavoriteMentorsReadModel({
      storage,
      transport: {
        fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
        addFavoriteMentor: addMock,
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics,
    });

    // 1. Guest toggle stores pending ID, emits centralized auth_gate_triggered analytics, and returns canonical getSignInUrl
    const guestOutcome = await model.toggle({
      userId: null,
      mentorId: 101,
      feature: 'mentor_pool',
    });
    expect(guestOutcome).toEqual({
      status: 'guest_redirect',
      signInUrl: '/auth/signin?callbackUrl=%2Fprofile%2F101',
      nextFavorited: false,
    });
    expect(storage.peekRaw()).toBe(101);
    expect(trackAnalytics).toHaveBeenCalledOnce();
    expect(trackAnalytics).toHaveBeenCalledWith({
      name: 'auth_gate_triggered',
      feature: 'favorites',
      metadata: {
        gate_feature: 'favorites',
        trigger_type: 'click_cta',
        mentor_id: 101,
      },
    });
    trackAnalytics.mockClear();

    // 2. Direct self-bookmark toggle is blocked without network call
    expect(
      await model.toggle({
        userId: '101',
        mentorId: 101,
        feature: 'profile',
      })
    ).toEqual({ status: 'self_blocked', nextFavorited: false });
    expect(addMock).not.toHaveBeenCalled();

    // 3. Replay keeps pending storage intact while PUT is in flight, clearing only after settlement
    const replayPromise = model.replayPendingForPage({
      userId: '999',
      pageMentorId: 101,
      mentor: { isMentor: true, snapshot: makeMentor(101) },
    });

    await vi.waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    expect(storage.peekRaw()).toBe(101);

    resolveReplayPut();
    const replayOutcome = await replayPromise;
    expect(replayOutcome).toEqual({ status: 'added', nextFavorited: true });
    expect(storage.peekRaw()).toBeNull();
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
  });

  it('preserves mutations that settle before an in-flight initial GET resolves (no stale GET overwrite)', async () => {
    let resolveInitialGet!: (items: MentorType[]) => void;
    const fetchMock = vi.fn().mockImplementationOnce(
      () =>
        new Promise<MentorType[]>((resolve) => {
          resolveInitialGet = resolve;
        })
    );

    const model = createFavoriteMentorsReadModel({
      transport: {
        fetchFavoriteMentors: fetchMock,
        addFavoriteMentor: vi.fn().mockResolvedValue(undefined),
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics: vi.fn(),
    });

    // T1: Initial GET starts (server still had [202], didn't have [101] yet)
    model.subscribe('user-1', () => {});

    // T2-T3: User adds 101 and PUT settles BEFORE initial GET resolves
    await model.toggle({
      userId: 'user-1',
      mentorId: 101,
      mentorSnapshot: makeMentor(101, 'Newly Added'),
      feature: 'mentor_pool',
    });
    expect(model.getMentorState('user-1', 101).isFavorited).toBe(true);

    // T4: Stale initial GET resolves with only [202] -> must preserve 101 + 202!
    resolveInitialGet([makeMentor(202, 'Existing Server Mentor')]);
    await vi.waitFor(() => {
      expect(
        model.getSnapshot('user-1')?.mentors.map((m) => m.user_id)
      ).toEqual([101, 202]);
    });
    expect(model.getMentorState('user-1', 101).isFavorited).toBe(true);
  });

  it('returns frozen singleton MentorBookmarkState objects across all states and referentially stable list snapshots with listStatus + Error (#941)', async () => {
    const serverFailure = new Error('502 Bad Gateway');
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(serverFailure)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMentor(101)]);

    let resolveAdd!: () => void;
    const addMock = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        })
    );

    const model = createFavoriteMentorsReadModel({
      transport: {
        fetchFavoriteMentors: fetchMock,
        addFavoriteMentor: addMock,
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics: vi.fn(),
    });

    // Frozen singletons for guest / self / member states
    const guestStateA = model.getMentorState(null, 101);
    const guestStateB = model.getMentorState(null, 202);
    expect(Object.isFrozen(guestStateA)).toBe(true);
    expect(guestStateA).toBe(guestStateB);

    const selfStateA = model.getMentorState('101', 101);
    const selfStateB = model.getMentorState('202', 202);
    expect(Object.isFrozen(selfStateA)).toBe(true);
    expect(selfStateA).toBe(selfStateB);
    expect(selfStateA).toEqual({
      isFavorited: false,
      isPending: false,
      isSelf: true,
    });

    // Initial loading list snapshot is referentially stable
    const loadingSnapA = model.getListSnapshot('user-1');
    const loadingSnapB = model.getListSnapshot('user-1');
    expect(loadingSnapA).toBe(loadingSnapB);
    expect(loadingSnapA.listStatus).toBe('loading');
    expect(loadingSnapA.isLoading).toBe(true);
    expect(loadingSnapA.isStoreReadyForUser).toBe(false);
    expect(loadingSnapA.error).toBeNull();

    const unsub = model.subscribe('user-1', () => {});

    // Error state preserves exact Error reference and referential snapshot stability
    await vi.waitFor(() => {
      expect(model.getListSnapshot('user-1').listStatus).toBe('error');
    });
    const errorSnapA = model.getListSnapshot('user-1');
    const errorSnapB = model.getListSnapshot('user-1');
    expect(errorSnapA).toBe(errorSnapB);
    expect(errorSnapA.error).toBe(serverFailure);
    expect(errorSnapA.isStoreReadyForUser).toBe(true);
    expect(errorSnapA.isLoading).toBe(false);

    // Retry transitions to empty list snapshot
    await model.retry('user-1');
    const emptySnapA = model.getListSnapshot('user-1');
    const emptySnapB = model.getListSnapshot('user-1');
    expect(emptySnapA).toBe(emptySnapB);
    expect(emptySnapA.listStatus).toBe('empty');
    expect(emptySnapA.error).toBeNull();

    // Retry with populated mentor transitions to success list snapshot
    await model.retry('user-1');
    const successSnapA = model.getListSnapshot('user-1');
    const successSnapB = model.getListSnapshot('user-1');
    expect(successSnapA).toBe(successSnapB);
    expect(model.getSnapshot('user-1')).toBe(successSnapA);
    expect(successSnapA.listStatus).toBe('success');
    expect(successSnapA.mentors.map((m) => m.user_id)).toEqual([101]);

    // Pending + favorited singleton check during toggle
    const togglePromise = model.toggle({
      userId: 'user-1',
      mentorId: 303,
      mentorSnapshot: makeMentor(303),
      feature: 'mentor_pool',
    });
    const pendingStateA = model.getMentorState('user-1', 303);
    const pendingStateB = model.getMentorState('user-1', 303);
    expect(Object.isFrozen(pendingStateA)).toBe(true);
    expect(pendingStateA).toBe(pendingStateB);
    expect(pendingStateA).toEqual({
      isFavorited: true,
      isPending: true,
      isSelf: false,
    });

    resolveAdd();
    await togglePromise;
    const settledStateA = model.getMentorState('user-1', 303);
    const settledStateB = model.getMentorState('user-1', 101);
    expect(settledStateA).toBe(settledStateB);
    expect(Object.isFrozen(settledStateA)).toBe(true);

    unsub();
  });

  it('atomically clears both in-memory session state and pendingFavoriteStorage on clear(), and handles null mentor profile during replayPendingForPage (#941)', async () => {
    const storage = createInMemoryPendingStorage();
    const model = createFavoriteMentorsReadModel({
      storage,
      transport: {
        fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
        addFavoriteMentor: vi.fn().mockResolvedValue(undefined),
        removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      },
      trackAnalytics: vi.fn(),
    });

    storage.savePending(101);
    // Non-self replay with mentor: null waits without clearing pending storage
    const waitingOutcome = await model.replayPendingForPage({
      userId: '999',
      pageMentorId: 101,
      mentor: null,
    });
    expect(waitingOutcome).toEqual({ status: 'noop', nextFavorited: false });
    expect(storage.peekRaw()).toBe(101);

    // Self replay with mentor: null immediately blocks and clears pending storage
    const selfOutcome = await model.replayPendingForPage({
      userId: '101',
      pageMentorId: 101,
      mentor: null,
    });
    expect(selfOutcome).toEqual({
      status: 'self_blocked',
      nextFavorited: false,
    });
    expect(storage.peekRaw()).toBeNull();

    // Seed in-memory state + save pending storage, then verify clear() wipes both atomically
    model.seed('999', [makeMentor(202)]);
    storage.savePending(303);
    expect(model.getSnapshot('999')).toBeDefined();
    expect(storage.peekRaw()).toBe(303);

    model.clear();

    expect(model.getSnapshot('999')).toBeUndefined();
    expect(model.getMentorState('999', 202)).toEqual({
      isFavorited: false,
      isPending: false,
      isSelf: false,
    });
    expect(storage.peekRaw()).toBeNull();
  });
});

describe('favoriteMentorsReadModel disabled flag guard (#913)', () => {
  it('short-circuits subscribe, toggle, replayPendingForPage, and retry with zero transport calls when favorites flag is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_FAVORITES', 'false');
    try {
      const fetchMock = vi.fn();
      const addMock = vi.fn();
      const removeMock = vi.fn();
      const clearPendingMock = vi.fn();

      const model = createFavoriteMentorsReadModel({
        transport: {
          fetchFavoriteMentors: fetchMock,
          addFavoriteMentor: addMock,
          removeFavoriteMentor: removeMock,
        },
        storage: {
          savePending: vi.fn(),
          getPendingMentorId: () => 101,
          clearPending: clearPendingMock,
        },
        trackAnalytics: vi.fn(),
      });

      const updates: unknown[] = [];
      const unsub = model.subscribe('user-1', (res) => updates.push(res));
      expect(model.getListSnapshot('user-1')).toMatchObject({
        mentors: [],
        listStatus: 'empty',
        isLoading: false,
        isStoreReadyForUser: false,
        error: null,
      });
      unsub();

      const toggleRes = await model.toggle({
        userId: 'user-1',
        mentorId: 101,
        feature: 'mentor_pool',
      });
      expect(toggleRes).toEqual({ status: 'noop', nextFavorited: false });

      const replayRes = await model.replayPendingForPage({
        userId: 'user-1',
        pageMentorId: 101,
        mentor: { isMentor: true },
      });
      expect(replayRes).toEqual({ status: 'noop', nextFavorited: false });
      expect(clearPendingMock).toHaveBeenCalledTimes(1);

      await model.retry('user-1');
      expect(model.getMentorState('user-1', 101)).toEqual({
        isFavorited: false,
        isPending: false,
        isSelf: false,
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(addMock).not.toHaveBeenCalled();
      expect(removeMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

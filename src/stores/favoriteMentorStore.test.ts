import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MentorType } from '@/types/mentor';

import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from './favoriteMentorStore';

function buildMentor(overrides: Partial<MentorType> = {}): MentorType {
  return fromPartial<MentorType>({
    user_id: 101,
    name: '陳宥廷 Austin',
    job_title: 'Senior PM',
    company: 'Google',
    have_skill: ['產品策略'],
    have_topic: ['職涯規劃'],
    ...overrides,
  });
}

describe('favoriteMentorStore', () => {
  const fetchMock =
    vi.fn<FavoriteMentorServiceAdapter['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorServiceAdapter['addFavoriteMentor']>();
  const removeMock =
    vi.fn<FavoriteMentorServiceAdapter['removeFavoriteMentor']>();

  beforeEach(() => {
    resetFavoriteMentorStore();
    vi.clearAllMocks();
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('loads favorite mentors once per userId and resets on logout or user switch', async () => {
    fetchMock.mockResolvedValueOnce([buildMentor({ user_id: 101 })]);

    await Promise.all([
      favoriteMentorStore.syncUser('user-1'),
      favoriteMentorStore.syncUser('user-1'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(favoriteMentorStore.getState().loadedUserId).toBe('user-1');
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);

    // Subsequent sync with same userId does not refetch
    await favoriteMentorStore.syncUser('user-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Switching user resets and fetches for new user
    fetchMock.mockResolvedValueOnce([buildMentor({ user_id: 202 })]);
    await favoriteMentorStore.syncUser('user-2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(favoriteMentorStore.getState().loadedUserId).toBe('user-2');
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);

    // Logging out clears state
    await favoriteMentorStore.syncUser(null);
    expect(favoriteMentorStore.getState().loadedUserId).toBeNull();
    expect(favoriteMentorStore.getState().favoriteMentorIds.size).toBe(0);
    expect(favoriteMentorStore.getState().favoriteMentors).toEqual([]);
  });

  it('optimistically adds and removes favorite mentor immediately before API settles', async () => {
    let resolveAdd!: () => void;
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        })
    );

    favoriteMentorStore.seedFavorites('user-1', []);
    const snapshot = buildMentor({ user_id: 303, name: 'Zahra' });

    const togglePromise = favoriteMentorStore.toggleFavorite(303, snapshot);

    // Immediate optimistic state
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);
    expect(favoriteMentorStore.isPending(303)).toBe(true);
    expect(favoriteMentorStore.getState().favoriteMentors[0]?.name).toBe(
      'Zahra'
    );

    // Concurrent duplicate click while pending is skipped
    const skippedOutcome = await favoriteMentorStore.toggleFavorite(303);
    expect(skippedOutcome).toEqual({ status: 'skipped', nextFavorited: true });
    expect(addMock).toHaveBeenCalledTimes(1);

    resolveAdd();
    const outcome = await togglePromise;
    expect(outcome).toEqual({ status: 'added', nextFavorited: true });
    expect(favoriteMentorStore.isPending(303)).toBe(false);
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);

    // Now remove optimistically
    removeMock.mockResolvedValueOnce(undefined);
    const removeOutcome = await favoriteMentorStore.toggleFavorite(303);
    expect(removeOutcome).toEqual({ status: 'removed', nextFavorited: false });
    expect(favoriteMentorStore.isFavorited(303)).toBe(false);
    expect(favoriteMentorStore.getState().favoriteMentors).toEqual([]);
  });

  it('rolls back optimistic add and remove when API fails', async () => {
    favoriteMentorStore.seedFavorites('user-1', [
      buildMentor({ user_id: 500, name: 'Existing Mentor' }),
    ]);

    // 1. Failed add rolls back to unfavorited
    addMock.mockRejectedValueOnce(new Error('500 Server Error'));
    const failedAdd = await favoriteMentorStore.toggleFavorite(
      600,
      buildMentor({ user_id: 600, name: 'New Mentor' })
    );

    expect(failedAdd.status).toBe('failed');
    expect(favoriteMentorStore.isFavorited(600)).toBe(false);
    expect(favoriteMentorStore.isPending(600)).toBe(false);
    expect(
      favoriteMentorStore
        .getState()
        .favoriteMentors.map((mentor) => mentor.user_id)
    ).toEqual([500]);

    // 2. Failed remove rolls back to favorited and restores mentor entry
    removeMock.mockRejectedValueOnce(new Error('Network Failure'));
    const failedRemove = await favoriteMentorStore.toggleFavorite(500);

    expect(failedRemove.status).toBe('failed');
    expect(favoriteMentorStore.isFavorited(500)).toBe(true);
    expect(favoriteMentorStore.isPending(500)).toBe(false);
    expect(favoriteMentorStore.getState().favoriteMentors[0]?.name).toBe(
      'Existing Mentor'
    );
  });

  it('ensureFavorite adds unfavorited mentor after syncing user and skips DELETE when already favorited', async () => {
    fetchMock.mockResolvedValueOnce([buildMentor({ user_id: 101 })]);
    addMock.mockResolvedValueOnce(undefined);

    // Already favorited on server -> syncs and keeps favorited without calling PUT or DELETE
    const existingOutcome = await favoriteMentorStore.ensureFavorite(
      'user-1',
      101
    );
    expect(existingOutcome).toEqual({
      status: 'skipped',
      nextFavorited: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(addMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);

    // Not yet favorited -> adds via PUT
    const addedOutcome = await favoriteMentorStore.ensureFavorite(
      'user-1',
      202,
      buildMentor({ user_id: 202, name: 'Zahra' })
    );
    expect(addedOutcome).toEqual({
      status: 'added',
      nextFavorited: true,
    });
    expect(addMock).toHaveBeenCalledWith(202);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
  });

  it('preserves optimistic toggle initiated while initial syncUser GET is in flight when stale GET resolves afterwards', async () => {
    let resolveInitialGet!: (mentors: MentorType[]) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<MentorType[]>((resolve) => {
          resolveInitialGet = resolve;
        })
    );
    addMock.mockResolvedValueOnce(undefined);

    const syncPromise = favoriteMentorStore.syncUser('user-1');
    const addedSnapshot = buildMentor({ user_id: 303, name: 'Zahra' });

    const toggleOutcome = await favoriteMentorStore.toggleFavorite(
      303,
      addedSnapshot
    );
    expect(toggleOutcome).toEqual({ status: 'added', nextFavorited: true });
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);

    // Stale initial GET resolves without 303 -> must preserve 303 via optimisticOverrides
    resolveInitialGet([buildMentor({ user_id: 101, name: 'Austin' })]);
    await syncPromise;

    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);
    expect(
      favoriteMentorStore
        .getState()
        .favoriteMentors.map((mentor) => mentor.user_id)
    ).toEqual([101, 303]);

    // Subsequent failed remove rolls back cleanly to favorited
    removeMock.mockRejectedValueOnce(new Error('500 Delete Failed'));
    const failedRemove = await favoriteMentorStore.toggleFavorite(303);
    expect(failedRemove.status).toBe('failed');
    expect(failedRemove.nextFavorited).toBe(true);
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);
  });

  it('rolls back failed toggle initiated during in-flight initial GET against the fetched server baseline', async () => {
    // Case A: Mentor 101 WAS already favorited on server when blind optimistic PUT fails after GET resolves
    let resolveGetA!: (mentors: MentorType[]) => void;
    let rejectPutA!: (reason?: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<MentorType[]>((resolve) => {
          resolveGetA = resolve;
        })
    );
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPutA = reject;
        })
    );

    const syncPromiseA = favoriteMentorStore.syncUser('user-1');
    const togglePromiseA = favoriteMentorStore.toggleFavorite(
      101,
      buildMentor({ user_id: 101, name: 'Client Austin' })
    );

    resolveGetA([
      buildMentor({ user_id: 202, name: 'Server Zahra' }),
      buildMentor({ user_id: 101, name: 'Server Austin' }),
    ]);
    await syncPromiseA;

    rejectPutA(new Error('500 Transient Error'));
    const outcomeA = await togglePromiseA;

    expect(outcomeA.status).toBe('failed');
    expect(outcomeA.nextFavorited).toBe(true);
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(favoriteMentorStore.isPending(101)).toBe(false);
    expect(
      favoriteMentorStore.getState().favoriteMentors.map((m) => ({
        id: m.user_id,
        name: m.name,
      }))
    ).toEqual([
      { id: 202, name: 'Server Zahra' },
      { id: 101, name: 'Server Austin' },
    ]);

    // Case B: Mentor 303 was NOT favorited on server when optimistic PUT fails after GET resolves
    resetFavoriteMentorStore();
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });

    let resolveGetB!: (mentors: MentorType[]) => void;
    let rejectPutB!: (reason?: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<MentorType[]>((resolve) => {
          resolveGetB = resolve;
        })
    );
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPutB = reject;
        })
    );

    const syncPromiseB = favoriteMentorStore.syncUser('user-1');
    const togglePromiseB = favoriteMentorStore.toggleFavorite(
      303,
      buildMentor({ user_id: 303, name: 'New Mentor' })
    );

    resolveGetB([buildMentor({ user_id: 202, name: 'Server Zahra' })]);
    await syncPromiseB;

    rejectPutB(new Error('Network Error'));
    const outcomeB = await togglePromiseB;

    expect(outcomeB.status).toBe('failed');
    expect(outcomeB.nextFavorited).toBe(false);
    expect(favoriteMentorStore.isFavorited(303)).toBe(false);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
    expect(
      favoriteMentorStore.getState().favoriteMentors.map((m) => m.user_id)
    ).toEqual([202]);
  });

  it('discards stale in-flight syncUser GET and toggleFavorite results after account switch or logout (userEpoch guard)', async () => {
    let resolveUser1Get!: (mentors: MentorType[]) => void;
    let resolveUser1Put!: () => void;
    let rejectUser2Put!: (reason?: unknown) => void;

    fetchMock.mockImplementationOnce(
      () =>
        new Promise<MentorType[]>((resolve) => {
          resolveUser1Get = resolve;
        })
    );
    addMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUser1Put = resolve;
        })
    );

    const user1Sync = favoriteMentorStore.syncUser('user-1');
    const user1Toggle = favoriteMentorStore.toggleFavorite(
      101,
      buildMentor({ user_id: 101, name: 'User1 Favorite' })
    );

    // Switch account to user-2 before user-1 requests settle
    fetchMock.mockResolvedValueOnce([
      buildMentor({ user_id: 202, name: 'User2 Favorite' }),
    ]);
    await favoriteMentorStore.syncUser('user-2');

    // Settle stale user-1 requests
    resolveUser1Get([buildMentor({ user_id: 999, name: 'Stale Server' })]);
    resolveUser1Put();
    await user1Sync;
    const staleOutcome = await user1Toggle;

    expect(staleOutcome).toEqual({ status: 'skipped', nextFavorited: false });
    expect(favoriteMentorStore.getState().loadedUserId).toBe('user-2');
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(favoriteMentorStore.isFavorited(999)).toBe(false);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
    expect(
      favoriteMentorStore.getState().favoriteMentors.map((m) => m.user_id)
    ).toEqual([202]);

    // Start an in-flight remove on user-2, then log out before it rejects
    removeMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectUser2Put = reject;
        })
    );
    const user2Toggle = favoriteMentorStore.toggleFavorite(202);
    await favoriteMentorStore.syncUser(null);

    rejectUser2Put(new Error('Aborted after logout'));
    const logoutOutcome = await user2Toggle;

    expect(logoutOutcome).toEqual({ status: 'skipped', nextFavorited: false });
    expect(favoriteMentorStore.getState().loadedUserId).toBeNull();
    expect(favoriteMentorStore.getState().favoriteMentorIds.size).toBe(0);
    expect(favoriteMentorStore.getState().favoriteMentors).toEqual([]);
    expect(favoriteMentorStore.getState().pendingMentorIds.size).toBe(0);
  });
});

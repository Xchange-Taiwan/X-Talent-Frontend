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

function createDeferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it('preserves optimistic overrides while initial GET is in flight and rolls back failed mutations against resolved server baseline', async () => {
    const initialFetch = createDeferred<MentorType[]>();
    const putAlreadyOnServer = createDeferred<void>();
    const putNewMentor = createDeferred<void>();
    const deleteSettledAdd = createDeferred<void>();

    fetchMock.mockReturnValueOnce(initialFetch.promise);
    // 1st PUT (mentor 101, actually already favorited on server) stays in flight until after GET resolves, then fails
    addMock.mockReturnValueOnce(putAlreadyOnServer.promise);
    // 2nd PUT (mentor 303, not on server) stays in flight until after GET resolves, then fails
    addMock.mockReturnValueOnce(putNewMentor.promise);
    // 3rd PUT (mentor 404) settles immediately while GET is still in flight, then user removes 404 while GET is still in flight
    addMock.mockResolvedValueOnce(undefined);
    removeMock.mockReturnValueOnce(deleteSettledAdd.promise);

    const syncPromise = favoriteMentorStore.syncUser('user-1');

    // Trigger optimistic add for 101 and 303 before initial GET settles
    const toggle101Promise = favoriteMentorStore.toggleFavorite(101);
    const toggle303Promise = favoriteMentorStore.toggleFavorite(
      303,
      buildMentor({ user_id: 303, name: 'Zahra' })
    );

    // Add 404 (settles) and then optimistically remove 404 while initial GET is still in flight
    await favoriteMentorStore.toggleFavorite(
      404,
      buildMentor({ user_id: 404, name: 'Settled Mentor' })
    );
    const remove404Promise = favoriteMentorStore.toggleFavorite(404);

    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);
    expect(favoriteMentorStore.isFavorited(404)).toBe(false);

    // Initial GET resolves: server actually has 101 and 404 favorited, plus 202
    initialFetch.resolve([
      buildMentor({ user_id: 101, name: 'Server Austin' }),
      buildMentor({ user_id: 202, name: 'Server Mentor 202' }),
      buildMentor({ user_id: 404, name: 'Settled Mentor' }),
    ]);
    await syncPromise;

    // Optimistic states must not be clobbered by initial GET completion
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
    expect(favoriteMentorStore.isFavorited(303)).toBe(true);
    expect(favoriteMentorStore.isFavorited(404)).toBe(false);

    // Now PUT 101 fails — must roll back to server truth (TRUE + Server Austin), NOT stale pre-GET false!
    putAlreadyOnServer.reject(new Error('500 Transient Failure'));
    const outcome101 = await toggle101Promise;
    expect(outcome101.status).toBe('failed');
    expect(outcome101.nextFavorited).toBe(true);
    expect(favoriteMentorStore.isFavorited(101)).toBe(true);
    expect(favoriteMentorStore.isPending(101)).toBe(false);
    expect(
      favoriteMentorStore
        .getState()
        .favoriteMentors.find((mentor) => mentor.user_id === 101)?.name
    ).toBe('Server Austin');

    // PUT 303 fails — not on server, so rolls back to false
    putNewMentor.reject(new Error('500 Transient Failure'));
    const outcome303 = await toggle303Promise;
    expect(outcome303.status).toBe('failed');
    expect(outcome303.nextFavorited).toBe(false);
    expect(favoriteMentorStore.isFavorited(303)).toBe(false);
    expect(favoriteMentorStore.isPending(303)).toBe(false);

    // DELETE 404 settles — remains removed
    deleteSettledAdd.resolve();
    const outcome404 = await remove404Promise;
    expect(outcome404).toEqual({ status: 'removed', nextFavorited: false });
    expect(favoriteMentorStore.isFavorited(404)).toBe(false);
  });

  it('ignores stale in-flight GET and toggle responses after account switch or logout', async () => {
    const user1Fetch = createDeferred<MentorType[]>();
    const user1Put = createDeferred<void>();
    const user2Put = createDeferred<void>();

    fetchMock.mockReturnValueOnce(user1Fetch.promise);
    addMock.mockReturnValueOnce(user1Put.promise);

    const syncUser1 = favoriteMentorStore.syncUser('user-1');
    const toggleUser1 = favoriteMentorStore.toggleFavorite(
      101,
      buildMentor({ user_id: 101, name: 'User 1 Mentor' })
    );

    // Switch to user-2 while user-1 GET and PUT are still in flight
    fetchMock.mockResolvedValueOnce([
      buildMentor({ user_id: 202, name: 'User 2 Mentor' }),
    ]);
    await favoriteMentorStore.syncUser('user-2');

    expect(favoriteMentorStore.getState().loadedUserId).toBe('user-2');
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
    expect(favoriteMentorStore.getState().pendingMentorIds.size).toBe(0);

    // Stale user-1 GET resolves and PUT rejects — must NOT pollute user-2 state
    user1Fetch.resolve([buildMentor({ user_id: 999, name: 'Stale Mentor' })]);
    user1Put.reject(new Error('Stale PUT failure'));
    await Promise.all([syncUser1, toggleUser1]);

    expect(favoriteMentorStore.getState().loadedUserId).toBe('user-2');
    expect(favoriteMentorStore.isFavorited(999)).toBe(false);
    expect(favoriteMentorStore.isFavorited(101)).toBe(false);
    expect(favoriteMentorStore.isFavorited(202)).toBe(true);
    expect(
      favoriteMentorStore
        .getState()
        .favoriteMentors.map((mentor) => mentor.user_id)
    ).toEqual([202]);

    // Start a pending toggle on user-2, then log out before it resolves
    addMock.mockReturnValueOnce(user2Put.promise);
    const toggleUser2 = favoriteMentorStore.toggleFavorite(
      303,
      buildMentor({ user_id: 303, name: 'Logged Out Toggle' })
    );

    await favoriteMentorStore.syncUser(null);
    expect(favoriteMentorStore.getState().loadedUserId).toBeNull();
    expect(favoriteMentorStore.getState().favoriteMentorIds.size).toBe(0);

    user2Put.resolve();
    await toggleUser2;

    expect(favoriteMentorStore.getState().loadedUserId).toBeNull();
    expect(favoriteMentorStore.getState().favoriteMentorIds.size).toBe(0);
    expect(favoriteMentorStore.getState().favoriteMentors).toEqual([]);
    expect(favoriteMentorStore.getState().pendingMentorIds.size).toBe(0);
  });
});

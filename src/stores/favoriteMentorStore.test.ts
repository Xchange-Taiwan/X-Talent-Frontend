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
});

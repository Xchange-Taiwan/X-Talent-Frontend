import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingFavoriteMentor,
  consumePendingFavoriteMentorForPage,
  getPendingFavoriteMentorId,
  getPendingFavoriteProfilePath,
  PENDING_FAVORITE_MENTOR_STORAGE_KEY,
  PENDING_FAVORITE_TTL_MS,
  savePendingFavoriteMentor,
} from './pendingFavoriteStorage';

describe('pendingFavoriteStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and retrieves mentorId and profile path within 30-minute TTL', () => {
    const baseTime = 1_760_000_000_000;
    const mentorId = 7482008160728084;

    savePendingFavoriteMentor(mentorId, baseTime);

    expect(getPendingFavoriteMentorId(baseTime + PENDING_FAVORITE_TTL_MS)).toBe(
      mentorId
    );
    expect(
      getPendingFavoriteProfilePath(baseTime + PENDING_FAVORITE_TTL_MS)
    ).toBe(`/profile/${mentorId}`);
  });

  it('expires and removes stored record once 30-minute TTL is exceeded', () => {
    const baseTime = 1_760_000_000_000;
    savePendingFavoriteMentor(101, baseTime);

    expect(
      getPendingFavoriteMentorId(baseTime + PENDING_FAVORITE_TTL_MS + 1)
    ).toBeNull();
    expect(
      getPendingFavoriteProfilePath(baseTime + PENDING_FAVORITE_TTL_MS + 1)
    ).toBeNull();
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();
  });

  it('consumes and clears pending favorite only when pageMentorId matches', () => {
    const baseTime = 1_760_000_000_000;
    savePendingFavoriteMentor(101, baseTime);

    // Visiting a different mentor profile preserves pending favorite
    expect(consumePendingFavoriteMentorForPage(202, baseTime + 1000)).toBe(
      false
    );
    expect(getPendingFavoriteMentorId(baseTime + 1000)).toBe(101);

    // Visiting matching mentor profile consumes and clears atomically
    expect(consumePendingFavoriteMentorForPage(101, baseTime + 2000)).toBe(
      true
    );
    expect(getPendingFavoriteMentorId(baseTime + 2000)).toBeNull();

    // Subsequent consumption for same mentor returns false
    expect(consumePendingFavoriteMentorForPage(101, baseTime + 3000)).toBe(
      false
    );
  });

  it('ignores invalid mentorId inputs and cleans up malformed localStorage payloads', () => {
    savePendingFavoriteMentor(0);
    savePendingFavoriteMentor(-10);
    savePendingFavoriteMentor(Number.NaN);
    savePendingFavoriteMentor(1.5);

    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();

    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      '{corrupted-json'
    );
    expect(getPendingFavoriteMentorId()).toBeNull();
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();

    window.localStorage.setItem(
      PENDING_FAVORITE_MENTOR_STORAGE_KEY,
      JSON.stringify({ mentorId: 'not-a-number', createdAt: Date.now() })
    );
    expect(getPendingFavoriteMentorId()).toBeNull();
    expect(
      window.localStorage.getItem(PENDING_FAVORITE_MENTOR_STORAGE_KEY)
    ).toBeNull();

    savePendingFavoriteMentor(303, 1_760_000_000_000);
    clearPendingFavoriteMentor();
    expect(getPendingFavoriteMentorId(1_760_000_000_000)).toBeNull();
  });
});

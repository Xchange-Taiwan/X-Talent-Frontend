import { act, renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type FavoriteMentorServiceAdapter,
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

import { useFavoriteMentors } from './useFavoriteMentors';

function createSessionWrapper(options: {
  userId?: string | null;
  status?: 'authenticated' | 'unauthenticated' | 'loading';
}) {
  const {
    userId = '9001',
    status = userId ? 'authenticated' : 'unauthenticated',
  } = options;

  const sessionValue =
    status === 'authenticated' && userId
      ? fromPartial<SessionContextValue>({
          data: {
            user: {
              id: userId,
              email: 'mentee@example.com',
              name: 'Mentee Viewer',
              onBoarding: true,
              isMentor: false,
            },
            accessToken: 'mock-token',
            expires: '2099-01-01T00:00:00.000Z',
          },
          status: 'authenticated',
          update: async () => null,
        })
      : fromPartial<SessionContextValue>({
          data: null,
          status: status === 'loading' ? 'loading' : 'unauthenticated',
          update: async () => null,
        });

  return function SessionWrapper({ children }: { children: ReactNode }) {
    return (
      <SessionContext.Provider value={sessionValue}>
        {children}
      </SessionContext.Provider>
    );
  };
}

describe('useFavoriteMentors', () => {
  const fetchMock =
    vi.fn<FavoriteMentorServiceAdapter['fetchFavoriteMentors']>();
  const addMock = vi.fn<FavoriteMentorServiceAdapter['addFavoriteMentor']>();
  const removeMock =
    vi.fn<FavoriteMentorServiceAdapter['removeFavoriteMentor']>();

  beforeEach(() => {
    resetFavoriteMentorStore();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue([]);
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
      fetchFavoriteMentors: fetchMock,
      addFavoriteMentor: addMock,
      removeFavoriteMentor: removeMock,
    });
  });

  it('holds unresolved state without syncing store while session is loading', () => {
    const { result } = renderHook(() => useFavoriteMentors(), {
      wrapper: createSessionWrapper({ userId: null, status: 'loading' }),
    });

    expect(result.current.isIdentityUnresolved).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isStoreReadyForUser).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.favoriteMentors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears store state and marks unauthenticated when session is unauthenticated', () => {
    favoriteMentorStore.seedFavorites('stale-user', [
      fromPartial<MentorType>({ user_id: 101, name: 'Stale Mentor' }),
    ]);

    const { result } = renderHook(() => useFavoriteMentors(), {
      wrapper: createSessionWrapper({
        userId: null,
        status: 'unauthenticated',
      }),
    });

    expect(result.current.isIdentityUnresolved).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isStoreReadyForUser).toBe(false);
    expect(result.current.favoriteMentors).toEqual([]);
    expect(favoriteMentorStore.getState().loadedUserId).toBeNull();
  });

  it('loads favorite mentors for authenticated user and reacts to store removals', async () => {
    fetchMock.mockResolvedValueOnce([
      fromPartial<MentorType>({
        user_id: 101,
        name: 'Zahra Mirzakhani',
        have_topic: ['portfolio_review'],
        have_skill: ['product_design'],
      }),
      fromPartial<MentorType>({
        user_id: 102,
        name: '陳宥廷 Austin',
        have_topic: ['career_planning'],
        have_skill: [],
      }),
    ]);

    const { result } = renderHook(() => useFavoriteMentors(), {
      wrapper: createSessionWrapper({
        userId: '9001',
        status: 'authenticated',
      }),
    });

    await waitFor(() => {
      expect(result.current.isStoreReadyForUser).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.favoriteMentors.map((m) => m.user_id)).toEqual([
      101, 102,
    ]);

    await act(async () => {
      await favoriteMentorStore.toggleFavorite(101);
    });

    expect(removeMock).toHaveBeenCalledWith(101);
    expect(result.current.favoriteMentors.map((m) => m.user_id)).toEqual([102]);
  });
});

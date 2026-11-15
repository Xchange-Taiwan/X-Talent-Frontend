'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { favoriteMentorStore } from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

import { useFavoriteSessionAuth } from './useFavoriteSessionAuth';

export interface UseFavoriteMentorsResult {
  favoriteMentors: MentorType[];
  confirmedUserId: string | null;
  isAuthenticated: boolean;
  isIdentityUnresolved: boolean;
  isStoreReadyForUser: boolean;
  isLoading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
}

export function useFavoriteMentors(): UseFavoriteMentorsResult {
  const { confirmedUserId, isIdentityUnresolved, isAuthenticated } =
    useFavoriteSessionAuth();

  useEffect(() => {
    if (isIdentityUnresolved) {
      return;
    }

    if (!isAuthenticated || !confirmedUserId) {
      void favoriteMentorStore.syncUser(null);
      return;
    }

    void favoriteMentorStore.syncUser(confirmedUserId);
  }, [confirmedUserId, isAuthenticated, isIdentityUnresolved]);

  const favoriteState = useSyncExternalStore(
    favoriteMentorStore.subscribe,
    favoriteMentorStore.getState,
    favoriteMentorStore.getServerSnapshot
  );

  const isStoreReadyForUser =
    isAuthenticated &&
    favoriteState.loadedUserId === confirmedUserId &&
    !favoriteState.isLoading;

  const error = isStoreReadyForUser ? favoriteState.loadError : null;

  const retry = useCallback(async () => {
    if (isIdentityUnresolved || !isAuthenticated || !confirmedUserId) {
      return;
    }
    await favoriteMentorStore.retrySync(confirmedUserId);
  }, [confirmedUserId, isAuthenticated, isIdentityUnresolved]);

  return {
    favoriteMentors: isStoreReadyForUser ? favoriteState.favoriteMentors : [],
    confirmedUserId,
    isAuthenticated,
    isIdentityUnresolved,
    isStoreReadyForUser,
    isLoading: isIdentityUnresolved || !isStoreReadyForUser,
    error,
    retry,
  };
}

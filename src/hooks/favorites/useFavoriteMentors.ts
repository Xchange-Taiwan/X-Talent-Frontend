'use client';

import { useEffect, useSyncExternalStore } from 'react';

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

  return {
    favoriteMentors: isStoreReadyForUser ? favoriteState.favoriteMentors : [],
    confirmedUserId,
    isAuthenticated,
    isIdentityUnresolved,
    isStoreReadyForUser,
    isLoading: isIdentityUnresolved || !isStoreReadyForUser,
  };
}

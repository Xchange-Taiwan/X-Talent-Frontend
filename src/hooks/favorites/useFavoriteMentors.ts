'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import {
  favoriteMentorsReadModel,
  type FavoritesListStatus,
} from '@/lib/favorites';
import type { MentorType } from '@/types/mentor';

export type { FavoritesListStatus };

const NOOP_UNSUBSCRIBE = (): void => {};

function getServerListSnapshot() {
  return favoriteMentorsReadModel.getListSnapshot(null);
}

export interface UseFavoriteMentorsResult {
  favoriteMentors: MentorType[];
  confirmedUserId: string | null;
  isAuthenticated: boolean;
  isIdentityUnresolved: boolean;
  isStoreReadyForUser: boolean;
  isLoading: boolean;
  error: Error | null;
  listStatus: FavoritesListStatus;
  retry: () => Promise<void>;
}

export function useFavoriteMentors(): UseFavoriteMentorsResult {
  const identity = useResolvedIdentity();

  const isAuthenticated = identity.state === 'confirmed-member';
  const confirmedUserId = isAuthenticated ? identity.userId : null;
  const isIdentityUnresolved =
    identity.state === 'unknown' || identity.state === 'hint-only';

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      confirmedUserId
        ? favoriteMentorsReadModel.subscribe(confirmedUserId, onStoreChange)
        : NOOP_UNSUBSCRIBE,
    [confirmedUserId]
  );

  const getSnapshot = useCallback(
    () => favoriteMentorsReadModel.getListSnapshot(confirmedUserId),
    [confirmedUserId]
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerListSnapshot
  );

  const retry = useCallback(async () => {
    if (!confirmedUserId) {
      return;
    }
    await favoriteMentorsReadModel.retry(confirmedUserId);
  }, [confirmedUserId]);

  return {
    favoriteMentors: snapshot.mentors,
    confirmedUserId,
    isAuthenticated,
    isIdentityUnresolved,
    isStoreReadyForUser: snapshot.isStoreReadyForUser,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    listStatus: snapshot.listStatus,
    retry,
  };
}

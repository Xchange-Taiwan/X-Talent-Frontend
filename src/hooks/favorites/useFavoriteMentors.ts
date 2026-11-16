'use client';

import { useCallback, useEffect, useState } from 'react';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import type { AsyncReadResult } from '@/lib/asyncReadManager';
import {
  favoriteMentorsReadModel,
  type FavoriteMentorsSnapshot,
} from '@/lib/favorites';
import type { MentorType } from '@/types/mentor';

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

interface ReadSubscriptionState {
  userId: string | null;
  result: AsyncReadResult<FavoriteMentorsSnapshot>;
}

const IDLE_RESULT: AsyncReadResult<FavoriteMentorsSnapshot> = {
  data: null,
  isLoading: false,
  error: null,
};

export function useFavoriteMentors(): UseFavoriteMentorsResult {
  const identity = useResolvedIdentity();

  const confirmedUserId =
    identity.state === 'confirmed-member' ? identity.userId : null;
  const isAuthenticated = identity.state === 'confirmed-member';
  const isIdentityUnresolved =
    identity.state === 'unknown' || identity.state === 'hint-only';

  const [subState, setSubState] = useState<ReadSubscriptionState>(() => {
    if (!confirmedUserId) {
      return { userId: null, result: IDLE_RESULT };
    }
    const cached = favoriteMentorsReadModel.getSnapshot(confirmedUserId);
    return cached
      ? {
          userId: confirmedUserId,
          result: { data: cached, isLoading: false, error: null },
        }
      : {
          userId: confirmedUserId,
          result: { data: null, isLoading: true, error: null },
        };
  });

  useEffect(() => {
    if (isIdentityUnresolved) {
      return;
    }

    if (!isAuthenticated || !confirmedUserId) {
      favoriteMentorsReadModel.clear();
      setSubState({ userId: null, result: IDLE_RESULT });
      return;
    }

    return favoriteMentorsReadModel.subscribe(confirmedUserId, (result) => {
      setSubState({ userId: confirmedUserId, result });
    });
  }, [confirmedUserId, isAuthenticated, isIdentityUnresolved]);

  const activeResult =
    confirmedUserId && subState.userId === confirmedUserId
      ? subState.result
      : null;

  const isStoreReadyForUser =
    isAuthenticated &&
    activeResult !== null &&
    !activeResult.isLoading &&
    (activeResult.data !== null || activeResult.error !== null);

  const error =
    isStoreReadyForUser && activeResult?.error
      ? new Error(activeResult.error)
      : null;

  const retry = useCallback(async () => {
    if (isIdentityUnresolved || !isAuthenticated || !confirmedUserId) {
      return;
    }
    await favoriteMentorsReadModel.retry(confirmedUserId);
  }, [confirmedUserId, isAuthenticated, isIdentityUnresolved]);

  return {
    favoriteMentors:
      isStoreReadyForUser && activeResult?.data
        ? activeResult.data.mentors
        : [],
    confirmedUserId,
    isAuthenticated,
    isIdentityUnresolved,
    isStoreReadyForUser,
    isLoading: isIdentityUnresolved || !isStoreReadyForUser,
    error,
    retry,
  };
}

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';

import { toast } from '@/components/ui/use-toast';
import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  type FavoriteMentorFeature,
  favoriteMentorsReadModel,
} from '@/lib/favorites';
import type { MentorType } from '@/types/mentor';

export type { FavoriteMentorFeature };

export const FAVORITE_MENTOR_ERROR_TOAST_MESSAGE = '收藏操作失敗，請稍後再試';

const FAVORITED_STATE_BIT = 1;
const PENDING_STATE_BIT = 2;
const SELF_STATE_BIT = 4;

function getServerMentorStateMask(): number {
  return 0;
}

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export interface UseFavoriteMentorOptions {
  mentorId: number;
  mentorSnapshot?: MentorType;
  feature?: FavoriteMentorFeature;
}

export interface UseFavoriteMentorResult {
  isFavorited: boolean;
  isPending: boolean;
  isSelf: boolean;
  identityState: ResolvedIdentity['state'];
  isIdentityUnresolved: boolean;
  isAuthenticated: boolean;
  handleToggleFavorite: () => Promise<void>;
}

export function useFavoriteMentor({
  mentorId,
  mentorSnapshot,
  feature = 'mentor_pool',
}: UseFavoriteMentorOptions): UseFavoriteMentorResult {
  const identity = useResolvedIdentity();
  const router = useOptionalRouter();

  const confirmedUserId =
    identity.state === 'confirmed-member' ? identity.userId : null;
  const isAuthenticated = identity.state === 'confirmed-member';
  const isIdentityUnresolved =
    identity.state === 'unknown' || identity.state === 'hint-only';

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      favoriteMentorsReadModel.subscribeMentorState(
        confirmedUserId,
        mentorId,
        onStoreChange
      ),
    [confirmedUserId, mentorId]
  );

  const getMentorStateMask = useCallback((): number => {
    const state = favoriteMentorsReadModel.getMentorState(
      confirmedUserId,
      mentorId
    );
    return (
      (state.isFavorited ? FAVORITED_STATE_BIT : 0) |
      (state.isPending ? PENDING_STATE_BIT : 0) |
      (state.isSelf ? SELF_STATE_BIT : 0)
    );
  }, [confirmedUserId, mentorId]);

  const mentorStateMask = useSyncExternalStore(
    subscribe,
    getMentorStateMask,
    getServerMentorStateMask
  );

  const isSelf = (mentorStateMask & SELF_STATE_BIT) !== 0;
  const isFavorited = isAuthenticated
    ? (mentorStateMask & FAVORITED_STATE_BIT) !== 0
    : false;
  const isPending = (mentorStateMask & PENDING_STATE_BIT) !== 0;

  const handleToggleFavorite = useCallback(async () => {
    if (isSelf || identity.state === 'hint-only') {
      return;
    }

    const outcome = await favoriteMentorsReadModel.toggle({
      userId: confirmedUserId,
      mentorId,
      mentorSnapshot,
      feature,
    });

    if (outcome.status === 'guest_redirect') {
      if (router) {
        router.push(outcome.signInUrl);
      } else if (typeof window !== 'undefined') {
        window.location.assign(outcome.signInUrl);
      }
      return;
    }

    if (outcome.status === 'failed') {
      toast({
        variant: 'destructive',
        title: FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
      });
    }
  }, [
    confirmedUserId,
    feature,
    identity.state,
    isSelf,
    mentorId,
    mentorSnapshot,
    router,
  ]);

  return {
    isFavorited,
    isPending,
    isSelf,
    identityState: identity.state,
    isIdentityUnresolved,
    isAuthenticated,
    handleToggleFavorite,
  };
}

'use client';

import { useRouter } from 'next/navigation';
import { SessionContext } from 'next-auth/react';
import {
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';

import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { savePendingFavoriteMentor } from '@/lib/favorites';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

export const FAVORITE_MENTOR_ERROR_TOAST_MESSAGE = '收藏操作失敗，請稍後再試';

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
}

export interface UseFavoriteMentorResult {
  isFavorited: boolean;
  isPending: boolean;
  isSelf: boolean;
  isIdentityUnresolved: boolean;
  isAuthenticated: boolean;
  handleToggleFavorite: () => Promise<void>;
}

export function useFavoriteMentor({
  mentorId,
  mentorSnapshot,
}: UseFavoriteMentorOptions): UseFavoriteMentorResult {
  const sessionContext = useContext(SessionContext);
  const router = useOptionalRouter();
  const { toast } = useToast();

  const session = sessionContext?.data ?? null;
  const sessionStatus = sessionContext?.status ?? 'unauthenticated';

  const rawSessionUserId = session?.user?.id;
  const confirmedUserId =
    rawSessionUserId !== undefined &&
    rawSessionUserId !== null &&
    String(rawSessionUserId).trim() !== ''
      ? String(rawSessionUserId).trim()
      : null;

  const isIdentityUnresolved = !confirmedUserId && sessionStatus === 'loading';
  const isAuthenticated = confirmedUserId !== null;

  useEffect(() => {
    if (confirmedUserId) {
      void favoriteMentorStore.syncUser(confirmedUserId);
    } else if (!isIdentityUnresolved) {
      void favoriteMentorStore.syncUser(null);
    }
  }, [confirmedUserId, isIdentityUnresolved]);

  const storeState = useSyncExternalStore(
    favoriteMentorStore.subscribe,
    favoriteMentorStore.getState,
    favoriteMentorStore.getServerSnapshot
  );

  const isSelf =
    confirmedUserId !== null && confirmedUserId === String(mentorId);
  const isFavorited = isAuthenticated
    ? storeState.favoriteMentorIds.has(mentorId)
    : false;
  const isPending = storeState.pendingMentorIds.has(mentorId);

  const handleToggleFavorite = useCallback(async () => {
    if (isSelf || isIdentityUnresolved) return;

    if (!isAuthenticated || !confirmedUserId) {
      if (Number.isSafeInteger(mentorId) && mentorId > 0) {
        savePendingFavoriteMentor(mentorId);
      }
      const callbackPath = `/profile/${mentorId}`;
      const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`;
      if (router) {
        router.push(signInUrl);
      } else if (typeof window !== 'undefined') {
        window.location.assign(signInUrl);
      }
      return;
    }

    if (
      !Number.isFinite(mentorId) ||
      mentorId <= 0 ||
      favoriteMentorStore.isPending(mentorId)
    ) {
      return;
    }

    void favoriteMentorStore.syncUser(confirmedUserId);

    const optimisticAction = favoriteMentorStore.isFavorited(mentorId)
      ? 'remove'
      : 'add';

    trackEvent({
      name: 'mentor_bookmark_toggle',
      feature: 'mentor_pool',
      metadata: {
        mentor_id: mentorId,
        action: optimisticAction,
      },
    });

    const outcome = await favoriteMentorStore.toggleFavorite(
      mentorId,
      mentorSnapshot
    );

    if (outcome.status === 'failed') {
      toast({
        variant: 'destructive',
        title: FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
      });
    }
  }, [
    isSelf,
    isIdentityUnresolved,
    isAuthenticated,
    confirmedUserId,
    mentorId,
    mentorSnapshot,
    router,
    toast,
  ]);

  return {
    isFavorited,
    isPending,
    isSelf,
    isIdentityUnresolved,
    isAuthenticated,
    handleToggleFavorite,
  };
}

'use client';

import { useRouter } from 'next/navigation';
import { SessionContext } from 'next-auth/react';
import {
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';

import { toast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { savePendingFavoriteMentor } from '@/lib/favorites';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

export const FAVORITE_MENTOR_ERROR_TOAST_MESSAGE = '收藏操作失敗，請稍後再試';

export type FavoriteMentorAnalyticsFeature = 'mentor_pool' | 'profile';

export type FavoriteMentorAnalyticsLocation =
  'mentor_pool_list' | 'profile_header' | 'favorites_list';

const FAVORITED_BIT = 1;
const PENDING_BIT = 2;

function getServerFavoriteSnapshot(): number {
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
  analyticsFeature?: FavoriteMentorAnalyticsFeature;
  analyticsLocation?: FavoriteMentorAnalyticsLocation;
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
  analyticsFeature = 'mentor_pool',
  analyticsLocation,
}: UseFavoriteMentorOptions): UseFavoriteMentorResult {
  const sessionContext = useContext(SessionContext);
  const router = useOptionalRouter();
  const resolvedAnalyticsLocation: FavoriteMentorAnalyticsLocation =
    analyticsLocation ??
    (analyticsFeature === 'profile' ? 'profile_header' : 'mentor_pool_list');

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

  const getMentorFavoriteSnapshot = useCallback(
    () =>
      (favoriteMentorStore.isFavorited(mentorId) ? FAVORITED_BIT : 0) |
      (favoriteMentorStore.isPending(mentorId) ? PENDING_BIT : 0),
    [mentorId]
  );

  const snapshotMask = useSyncExternalStore(
    favoriteMentorStore.subscribe,
    getMentorFavoriteSnapshot,
    getServerFavoriteSnapshot
  );

  const isSelf =
    confirmedUserId !== null && confirmedUserId === String(mentorId);
  const isFavorited = isAuthenticated
    ? (snapshotMask & FAVORITED_BIT) !== 0
    : false;
  const isPending = (snapshotMask & PENDING_BIT) !== 0;

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
      feature: analyticsFeature,
      metadata: {
        mentor_id: mentorId,
        action: optimisticAction,
        button_location: resolvedAnalyticsLocation,
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
    analyticsFeature,
    resolvedAnalyticsLocation,
    isSelf,
    isIdentityUnresolved,
    isAuthenticated,
    confirmedUserId,
    mentorId,
    mentorSnapshot,
    router,
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

'use client';

import { useEffect } from 'react';

import { toast } from '@/components/ui/use-toast';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { consumePendingFavoriteMentorForPage } from '@/lib/favorites';
import { normalizeMentorFromProfile } from '@/lib/mentor/mentorCardModel';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';

import { FAVORITE_MENTOR_ERROR_TOAST_MESSAGE } from './useFavoriteMentor';

export const FAVORITE_SELF_BLOCKED_TOAST_MESSAGE = '無法收藏自己';

export interface UseConsumePendingFavoriteOptions {
  pageUserId: string;
  loginUserId: string;
  userData: UserType | null;
  userLoading: boolean;
}

export function useConsumePendingFavorite({
  pageUserId,
  loginUserId,
  userData,
  userLoading,
}: UseConsumePendingFavoriteOptions): void {
  useEffect(() => {
    const normalizedLoginUserId = loginUserId.trim();
    if (!normalizedLoginUserId || userLoading) {
      return;
    }

    const pageMentorId = Number(pageUserId);
    if (!Number.isSafeInteger(pageMentorId) || pageMentorId <= 0) {
      return;
    }

    if (normalizedLoginUserId === String(pageMentorId)) {
      if (consumePendingFavoriteMentorForPage(pageMentorId)) {
        toast({
          variant: 'destructive',
          title: FAVORITE_SELF_BLOCKED_TOAST_MESSAGE,
        });
      }
      return;
    }

    if (!userData || userData.user_id !== pageMentorId) {
      return;
    }

    const consumed = consumePendingFavoriteMentorForPage(pageMentorId);
    if (!consumed) {
      return;
    }

    if (!userData.is_mentor) {
      return;
    }

    const snapshot = normalizeMentorFromProfile(userData);

    void (async () => {
      const wasAlreadyFavorited =
        favoriteMentorStore.getState().loadedUserId === normalizedLoginUserId &&
        favoriteMentorStore.isFavorited(pageMentorId);

      const outcome = await favoriteMentorStore.ensureFavorite(
        normalizedLoginUserId,
        pageMentorId,
        snapshot
      );

      if (outcome.status === 'added' && !wasAlreadyFavorited) {
        trackEvent({
          name: 'mentor_bookmark_toggle',
          feature: 'profile',
          metadata: {
            mentor_id: pageMentorId,
            action: 'add',
          },
        });
      } else if (outcome.status === 'failed') {
        toast({
          variant: 'destructive',
          title: FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
        });
      }
    })();
  }, [loginUserId, pageUserId, userData, userLoading]);
}

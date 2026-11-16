'use client';

import { useEffect } from 'react';

import { toast } from '@/components/ui/use-toast';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  clearPendingFavoriteMentor,
  favoriteMentorsReadModel,
} from '@/lib/favorites';
import { isFavoritesEnabled } from '@/lib/featureFlags';
import { normalizeMentorFromProfile } from '@/lib/mentor/mentorCardModel';

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
    if (!isFavoritesEnabled()) {
      clearPendingFavoriteMentor();
      return;
    }

    const normalizedLoginUserId = loginUserId.trim();
    if (!normalizedLoginUserId || userLoading) {
      return;
    }

    const pageMentorId = Number(pageUserId);
    if (!Number.isSafeInteger(pageMentorId) || pageMentorId <= 0) {
      return;
    }

    if (normalizedLoginUserId === String(pageMentorId)) {
      void favoriteMentorsReadModel
        .replayPendingForPage({
          userId: normalizedLoginUserId,
          pageMentorId,
          mentor: { isMentor: Boolean(userData?.is_mentor) },
        })
        .then((outcome) => {
          if (outcome.status === 'self_blocked') {
            toast({
              variant: 'destructive',
              title: FAVORITE_SELF_BLOCKED_TOAST_MESSAGE,
            });
          }
        });
      return;
    }

    if (!userData || userData.user_id !== pageMentorId) {
      return;
    }

    const snapshot = userData.is_mentor
      ? normalizeMentorFromProfile(userData)
      : undefined;

    void favoriteMentorsReadModel
      .replayPendingForPage({
        userId: normalizedLoginUserId,
        pageMentorId,
        mentor: {
          isMentor: Boolean(userData.is_mentor),
          snapshot,
        },
      })
      .then((outcome) => {
        if (outcome.status === 'failed') {
          toast({
            variant: 'destructive',
            title: FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
          });
        }
      });
  }, [loginUserId, pageUserId, userData, userLoading]);
}

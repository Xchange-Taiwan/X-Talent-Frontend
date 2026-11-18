'use client';

import { useEffect } from 'react';

import { toast } from '@/components/ui/use-toast';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { favoriteMentorsReadModel } from '@/lib/favorites';
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
    const pageMentorId = Number(pageUserId);
    const matchedProfile =
      !userLoading && userData !== null && userData.user_id === pageMentorId
        ? userData
        : null;

    void favoriteMentorsReadModel
      .replayPendingForPage({
        userId: userLoading ? '' : loginUserId,
        pageMentorId,
        mentor: matchedProfile
          ? {
              isMentor: Boolean(matchedProfile.is_mentor),
              snapshot: matchedProfile.is_mentor
                ? normalizeMentorFromProfile(matchedProfile)
                : undefined,
            }
          : null,
      })
      .then((outcome) => {
        if (outcome.status === 'self_blocked') {
          toast({
            variant: 'destructive',
            title: FAVORITE_SELF_BLOCKED_TOAST_MESSAGE,
          });
        } else if (outcome.status === 'failed') {
          toast({
            variant: 'destructive',
            title: FAVORITE_MENTOR_ERROR_TOAST_MESSAGE,
          });
        }
      });
  }, [loginUserId, pageUserId, userData, userLoading]);
}

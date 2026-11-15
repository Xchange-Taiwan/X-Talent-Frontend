'use client';

import { useEffect } from 'react';

import { toast } from '@/components/ui/use-toast';
import type { UserType } from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { consumePendingFavoriteMentorForPage } from '@/lib/favorites';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';
import type { MentorType } from '@/types/mentor';

import { FAVORITE_MENTOR_ERROR_TOAST_MESSAGE } from './useFavoriteMentor';

export const FAVORITE_SELF_BLOCKED_TOAST_MESSAGE = '無法收藏自己';

export interface UseConsumePendingFavoriteOptions {
  pageUserId: string;
  loginUserId: string;
  userData: UserType | null;
  userLoading: boolean;
}

function toMentorSnapshot(userData: UserType): MentorType {
  return {
    user_id: userData.user_id,
    name: userData.name,
    avatar: userData.avatar,
    job_title: userData.job_title,
    company: userData.company,
    years_of_experience: userData.years_of_experience ?? '',
    location: userData.location ?? '',
    personal_statement: userData.personal_statement ?? '',
    about: userData.about ?? '',
    seniority_level: '',
    industry: userData.industry ?? null,
    want_position: userData.want_position.map((tag) => tag.subject),
    want_skill: userData.want_skill.map((tag) => tag.subject),
    want_topic: userData.want_topic.map((tag) => tag.subject),
    have_skill: userData.have_skill.map((tag) => tag.subject),
    have_topic: userData.have_topic.map((tag) => tag.subject),
    updated_at: null,
    stats: userData.stats ?? null,
  };
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

    const snapshot = toMentorSnapshot(userData);

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

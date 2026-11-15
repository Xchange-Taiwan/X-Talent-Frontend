'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

import { useFavoriteMentors } from '@/hooks/favorites';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import { getSignInUrl } from '@/lib/routes';

import FavoritesPageUI, { type FavoritesListStatus } from './ui';

const FAVORITES_PATH = '/favorites';

export default function FavoritesPageContainer() {
  const router = useRouter();
  const {
    favoriteMentors,
    isAuthenticated,
    isIdentityUnresolved,
    isStoreReadyForUser,
    error,
    retry,
  } = useFavoriteMentors();

  useEffect(() => {
    if (!isIdentityUnresolved && !isAuthenticated) {
      router.replace(getSignInUrl(FAVORITES_PATH));
    }
  }, [isAuthenticated, isIdentityUnresolved, router]);

  const tagCatalog = useTagCatalog('zh_TW');
  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  const mentors = useMemo(
    () =>
      favoriteMentors.map((mentor) => ({
        ...mentor,
        have_topic: mentor.have_topic.map((code) => labelMap.get(code) ?? code),
        have_skill: mentor.have_skill.map((code) => labelMap.get(code) ?? code),
      })),
    [favoriteMentors, labelMap]
  );

  const listStatus: FavoritesListStatus = useMemo(() => {
    if (!isStoreReadyForUser) {
      return 'loading';
    }
    if (error) {
      return 'error';
    }
    return mentors.length > 0 ? 'success' : 'empty';
  }, [error, isStoreReadyForUser, mentors.length]);

  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  return (
    <FavoritesPageUI
      mentors={mentors}
      mentorCount={mentors.length}
      listStatus={listStatus}
      onRetry={handleRetry}
    />
  );
}

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

  const listStatus: FavoritesListStatus = useMemo(() => {
    if (!isStoreReadyForUser) {
      return 'loading';
    }
    if (error) {
      return 'error';
    }
    return favoriteMentors.length > 0 ? 'success' : 'empty';
  }, [error, favoriteMentors.length, isStoreReadyForUser]);

  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  return (
    <FavoritesPageUI
      mentors={favoriteMentors}
      mentorCount={favoriteMentors.length}
      labelMap={labelMap}
      listStatus={listStatus}
      onRetry={handleRetry}
    />
  );
}

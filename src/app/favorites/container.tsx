'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';

import { useFavoriteMentors } from '@/hooks/favorites';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import { getSignInUrl } from '@/lib/routes';

import FavoritesPageUI from './ui';

const FAVORITES_PATH = '/favorites';

export default function FavoritesPageContainer() {
  const router = useRouter();
  const {
    favoriteMentors,
    isAuthenticated,
    isIdentityUnresolved,
    listStatus,
    retry,
  } = useFavoriteMentors();

  useEffect(() => {
    if (!isIdentityUnresolved && !isAuthenticated) {
      router.replace(getSignInUrl(FAVORITES_PATH));
    }
  }, [isAuthenticated, isIdentityUnresolved, router]);

  const tagCatalog = useTagCatalog('zh_TW');
  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

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

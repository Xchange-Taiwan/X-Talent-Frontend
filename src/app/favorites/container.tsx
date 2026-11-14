'use client';

import { useRouter } from 'next/navigation';
import { SessionContext } from 'next-auth/react';
import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import { getSignInUrl } from '@/lib/routes';
import { favoriteMentorStore } from '@/stores/favoriteMentorStore';

import FavoritesPageUI, { type FavoritesListStatus } from './ui';

const FAVORITES_PATH = '/favorites';

export default function FavoritesPageContainer() {
  const sessionContext = useContext(SessionContext);
  const router = useRouter();

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
    if (isIdentityUnresolved) {
      return;
    }

    if (!isAuthenticated || !confirmedUserId) {
      void favoriteMentorStore.syncUser(null);
      router.replace(getSignInUrl(FAVORITES_PATH));
      return;
    }

    void favoriteMentorStore.syncUser(confirmedUserId);
  }, [confirmedUserId, isAuthenticated, isIdentityUnresolved, router]);

  const favoriteState = useSyncExternalStore(
    favoriteMentorStore.subscribe,
    favoriteMentorStore.getState,
    favoriteMentorStore.getServerSnapshot
  );

  const tagCatalog = useTagCatalog('zh_TW');
  const labelMap = useMemo(() => buildTagLabelMap(tagCatalog), [tagCatalog]);

  const mentors = useMemo(
    () =>
      favoriteState.favoriteMentors.map((mentor) => ({
        ...mentor,
        have_topic: mentor.have_topic.map((code) => labelMap.get(code) ?? code),
        have_skill: mentor.have_skill.map((code) => labelMap.get(code) ?? code),
      })),
    [favoriteState.favoriteMentors, labelMap]
  );

  const isStoreReadyForUser =
    isAuthenticated &&
    favoriteState.loadedUserId === confirmedUserId &&
    !favoriteState.isLoading;

  const listStatus: FavoritesListStatus = useMemo(() => {
    if (!isStoreReadyForUser) {
      return 'loading';
    }
    return mentors.length > 0 ? 'success' : 'empty';
  }, [isStoreReadyForUser, mentors.length]);

  const resolvedMentors = isStoreReadyForUser ? mentors : [];

  return (
    <FavoritesPageUI
      mentors={resolvedMentors}
      mentorCount={resolvedMentors.length}
      listStatus={listStatus}
    />
  );
}

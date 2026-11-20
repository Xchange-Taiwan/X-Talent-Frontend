import { useMemo } from 'react';

import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { projectUserProfile } from '@/lib/profile/profileProjection';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO, TagDisplay, UserType } from '@/types/user';

import { useUserProfileDto } from './useUserProfileDto';

export type { TagDisplay, UserType };

export function primeUserDataCache(
  userId: number | string,
  language: string,
  data: MentorProfileVO
): void {
  profileReadModel.prime({ userId, language }, data);
}

function useUserData(
  userId: number | string,
  language: string,
  initialDto?: MentorProfileVO | null,
  initialCatalogs?: TagCatalogsByBucket
) {
  // /profile/[pageUserId]/page.tsx handles 404 via notFound() on the server
  // and types initialDto as non-null MentorProfileVO. The only caller that
  // passes initialDto = null is /profile/card (an authenticated route for the
  // logged-in user), where null signals that the SSR prefetch failed and
  // useUserData should fall back to the client-side fetch (see
  // app/profile/card/page.tsx). Direct callers of useUserProfileDto that pass
  // null still get synchronous USER_NOT_FOUND without a redundant fetch.
  const {
    userDto,
    isLoading: dtoLoading,
    error,
    refetch,
  } = useUserProfileDto(userId, language, initialDto ?? undefined);
  // Catalog supplies localized labels for the raw subject_group arrays
  // (want_*, have_*) and for the enriched industry. Loads in parallel with
  // the user dto and is cached app-wide via tagCatalogReadManager.
  const tagCatalog = useTagCatalog(language, initialCatalogs);

  const userData: UserType | null = useMemo(
    () =>
      userDto
        ? projectUserProfile(userDto, { catalogs: tagCatalog, language })
        : null,
    [userDto, tagCatalog, language]
  );

  return { userData, isLoading: dtoLoading, error, refetch };
}

export default useUserData;

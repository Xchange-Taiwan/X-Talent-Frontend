'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageLoading } from '@/components/ui/loading-spinner';
import { primeTagCatalogCacheIfEmpty } from '@/hooks/user/tags/useTagCatalog';
import useUserData from '@/hooks/user/user-data/useUserData';
import { primeUserProfileDtoCacheIfEmpty } from '@/hooks/user/user-data/useUserProfileDto';
import { getMentorOnboardingUrl } from '@/lib/routes';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

const ProfileCardUI = dynamic(() => import('./ui'));

interface Props {
  loginUserId: number;
  initialDto: MentorProfileVO | null;
  initialCatalogs: TagCatalogsByBucket | null;
}

export default function ProfileCardContainer({
  loginUserId,
  initialDto,
  initialCatalogs,
}: Props) {
  const router = useRouter();

  // Synchronously seed the in-memory caches from the SSR-fetched data BEFORE
  // child hooks run - this is intentionally inside render (not useEffect) so
  // useUserProfileDto's lazy-init useState reads the primed entry on its
  // first render. That's what puts the avatar in the initial HTML instead of
  // behind a client-side session + data fetch (see issue #591). Done inside a
  // useState lazy initializer (React's sanctioned "run once during render"
  // escape hatch) rather than a plain ref write, since writing ref.current
  // during render is disallowed by React and can behave inconsistently under
  // Strict Mode / concurrent rendering. A null initialDto/initialCatalogs
  // (the SSR fetch failed) is left un-primed so the client-side fallback
  // fetch in useUserData/useTagCatalog actually runs instead of the cache
  // looking like it already holds a successful (but empty) result.
  useState(() => {
    if (initialDto) {
      primeUserProfileDtoCacheIfEmpty(loginUserId, 'zh_TW', initialDto);
    }
    if (initialCatalogs) {
      primeTagCatalogCacheIfEmpty('zh_TW', initialCatalogs);
    }
    return true;
  });

  const { userData, isLoading } = useUserData(loginUserId, 'zh_TW');

  if (isLoading) return <PageLoading />;
  if (!userData) return null;

  const isMentor = userData.is_mentor;
  const linkedinUrl =
    userData.personalLinks?.find(
      (link) => link.platform.toLowerCase() === 'linkedin'
    )?.url ?? '';

  return (
    <ProfileCardUI
      userData={userData}
      isMentor={isMentor}
      linkedinUrl={linkedinUrl}
      onBecomeMentor={() => router.push(getMentorOnboardingUrl(loginUserId))}
      onGoToMentorPool={() => router.push('/mentor-pool')}
      onBackToProfile={() => router.push(`/profile/${loginUserId}`)}
    />
  );
}

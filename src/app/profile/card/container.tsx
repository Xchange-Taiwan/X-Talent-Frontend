'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

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
  initialCatalogs: TagCatalogsByBucket;
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
  // behind a client-side session + data fetch (see issue #591). Guarded by a
  // ref (rather than relying solely on the cache's own `ifEmpty` idempotency)
  // so this render-phase side effect runs at most once per mount, including
  // under React Strict Mode's double-invoke.
  const primedRef = useRef(false);
  if (!primedRef.current) {
    if (initialDto) {
      primeUserProfileDtoCacheIfEmpty(loginUserId, 'zh_TW', initialDto);
    }
    primeTagCatalogCacheIfEmpty('zh_TW', initialCatalogs);
    primedRef.current = true;
  }

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

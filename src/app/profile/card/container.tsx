'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { PageLoading } from '@/components/ui/loading-spinner';
import useUserData from '@/hooks/user/user-data/useUserData';
import { getMentorOnboardingUrl, OPEN_SCHEDULE_DIALOG_KEY } from '@/lib/routes';
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

  // initialDto/initialCatalogs come from page.tsx's SSR fetch and are passed
  // straight through as useUserData's initialData params, which seed its
  // underlying hooks' lazy useState initializers directly - no cache read or
  // write happens in this component's own render. That's what puts the
  // avatar in the initial HTML with no client-side fetch waterfall (see
  // issue #591), without this render-phase code ever mutating the shared,
  // process-wide profile-dto/tag-catalog caches - those hooks only warm the
  // cache from their own mount effects, which never run during SSR. A null
  // value (the SSR fetch failed) is treated by the hooks exactly like no
  // initialData was passed, so the client-side fallback fetch still runs.
  const { userData, isLoading } = useUserData(
    loginUserId,
    'zh_TW',
    initialDto,
    initialCatalogs ?? undefined
  );

  if (isLoading) return <PageLoading />;
  if (!userData) return null;

  const isMentor = userData.is_mentor;
  const personalLinks = userData.personalLinks ?? [];

  return (
    <ProfileCardUI
      userData={userData}
      isMentor={isMentor}
      personalLinks={personalLinks}
      onBecomeMentor={() => router.push(getMentorOnboardingUrl(loginUserId))}
      onGoToMentorPool={() => router.push('/mentor-pool')}
      onBackToProfile={() => router.push(`/profile/${loginUserId}`)}
      onSetupSchedule={() =>
        router.push(`/profile/${loginUserId}?${OPEN_SCHEDULE_DIALOG_KEY}=true`)
      }
      onEditProfile={() => router.push(`/profile/${loginUserId}/edit`)}
    />
  );
}

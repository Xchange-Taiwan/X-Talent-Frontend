'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import useUserData from '@/hooks/user/user-data/useUserData';

const ProfileCardUI = dynamic(() => import('./ui'));

export default function ProfileCardContainer() {
  const router = useRouter();
  const [loginUserId, setLoginUserId] = useState<number | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const session = await getSession();
      const idFromSession = session?.user?.id ? Number(session.user.id) : null;
      setLoginUserId(
        idFromSession && !Number.isNaN(idFromSession) ? idFromSession : null
      );
    };

    loadSession();
  }, []);

  const { userData, isLoading } = useUserData(loginUserId ?? 0, 'zh_TW');

  if (isLoading || !loginUserId) return null;
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
      onBecomeMentor={() =>
        router.push(`/profile/${loginUserId}/edit?onboarding=true`)
      }
      onGoToMentorPool={() => router.push('/mentor-pool')}
      onBackToProfile={() => router.push(`/profile/${loginUserId}`)}
    />
  );
}

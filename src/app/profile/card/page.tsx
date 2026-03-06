'use client';

import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui/button';
import useUserData from '@/hooks/user/userData/useUserData';

export default function Page() {
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

  if (isLoading || !loginUserId) {
    return null;
  }

  if (!userData) {
    return null;
  }

  const isMentor = userData.is_mentor;

  const linkedinUrl =
    userData.personalLinks?.find(
      (link) => link.platform.toLowerCase() === 'linkedin'
    )?.url ?? '';

  return (
    <div className="mx-auto w-11/12 max-w-[630px] pb-20 pt-10">
      <div className="text-center">
        {!isMentor && (
          <p className="mb-3 text-4xl font-bold">恭喜你完成個人頁面的建立！</p>
        )}
        {isMentor && <p className="mb-3 text-4xl font-bold">恭喜！</p>}

        {!isMentor && (
          <p className="text-base">
            Now you can explore mentors or build your mentor profile in just 1
            step.
          </p>
        )}
      </div>

      <div className="py-10">
        {!isMentor && (
          <ProfileCard
            name={userData.name}
            avatarImgUrl={userData.avatar}
            company={userData.company}
            jobTitle={userData.job_title}
            linkedinUrl={linkedinUrl}
            interestedRole={userData.interested_positions}
            skillEnhancementTarget={userData.skills}
            talkTopic={userData.topics}
          />
        )}

        {isMentor && (
          <ProfileCard
            name={userData.name}
            avatarImgUrl={userData.avatar}
            company={userData.company}
            jobTitle={userData.job_title}
            linkedinUrl={linkedinUrl}
            expertise={userData.expertises}
            whatIOffer={userData.what_i_offers}
          />
        )}
      </div>

      {!isMentor && (
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            onClick={() =>
              router.push(`/profile/${loginUserId}/edit?onboarding=true`)
            }
          >
            成為 Mentor
          </Button>
          <Button
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            onClick={() => router.push('/mentor-pool')}
          >
            開始探索 X-Talent
          </Button>
        </div>
      )}

      {isMentor && (
        <div className="flex justify-center gap-4">
          <Button
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            onClick={() => router.push(`/profile/${loginUserId}`)}
          >
            Back to my profile
          </Button>
        </div>
      )}
    </div>
  );
}

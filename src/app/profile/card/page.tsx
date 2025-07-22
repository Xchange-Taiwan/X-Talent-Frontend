'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui/button';
import { fetchUser } from '@/services/profile/user';
import { UserType } from '@/services/profile/user';

export default function Page() {
  const router = useRouter();
  const [isMentor, setIsMentor] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserType | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
          setUserData(data);
          setIsMentor(data.is_mentor);
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchUserData();
  }, []);

  const linkedInUrl =
    (
      userData?.experiences?.find((exp) => {
        const category = exp.category as string;
        const metadata = exp.mentor_experiences_metadata as {
          platform?: string;
          url?: string;
        };
        return (
          category === 'LINK' &&
          metadata?.platform?.toLowerCase() === 'linkedin'
        );
      })?.mentor_experiences_metadata as { url?: string } | undefined
    )?.url || '';

  const firstWorkExperience = userData?.experiences?.find(
    (exp) => (exp.category as string) === 'WORK',
  );

  const metadata = firstWorkExperience?.mentor_experiences_metadata as {
    company?: string;
    job?: string;
  };

  const firstWorkExperienceCompany = metadata?.company || '';
  const firstWorkExperienceTitle = metadata?.job || '';

  if (!userData) {
    return null;
  }

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
        {!isMentor && userData && (
          <ProfileCard
            name={userData.name}
            avatarImgUrl={userData.avatar}
            company={firstWorkExperienceCompany}
            jobTitle={firstWorkExperienceTitle}
            linkedinUrl={linkedInUrl}
            interestedRole={userData.interested_positions.interests}
            skillEnhancementTarget={userData.skills.interests}
            talkTopic={userData.topics.interests}
          />
        )}
        {isMentor && userData && (
          <ProfileCard
            name={userData.name}
            avatarImgUrl={userData.avatar}
            company={firstWorkExperienceCompany}
            jobTitle={firstWorkExperienceTitle}
            linkedinUrl={linkedInUrl}
            expertise={userData.expertises?.professions}
          />
        )}
      </div>

      {!isMentor && (
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            className="grow rounded-full px-6  py-3 sm:grow-0"
            onClick={() =>
              router.push(`/profile/${userData?.user_id}/edit?onboarding=true`)
            }
          >
            成為 Mentor
          </Button>
          <Button
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            onClick={() => router.push('/mentorPool')}
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
            onClick={() => router.push(`/profile/${userData?.user_id}`)}
          >
            Back to my profile
          </Button>
        </div>
      )}
    </div>
  );
}

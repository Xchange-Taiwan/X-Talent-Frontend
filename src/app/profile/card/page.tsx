'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui/button';
import { fetchUser } from '@/services/user/user';
import { UserType } from '@/services/user/user';

export default function Page() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserType | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
          setUserData(data);
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchUserData();
  }, []);

  return (
    <div className="mx-auto w-11/12 max-w-[630px] pb-20 pt-10">
      <div className="text-center">
        <p className="mb-3 text-4xl font-bold">恭喜你完成個人頁面的建立！</p>
        <p className="text-base">
          Now you can explore mentors or build your mentor profile in just 1
          step.
        </p>
      </div>

      <div className="py-10">
        {userData && (
          <ProfileCard
            name={userData.name}
            avatarImgUrl={userData.avatar}
            company={userData.company}
            jobTitle={userData.job_title}
            linkedinUrl={userData.linkedin_profile}
            interestedRole={userData.interested_positions.interests}
            skillEnhancementTarget={userData.skills.interests}
            talkTopic={userData.topics.interests}
          />
        )}
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          className="grow rounded-full px-6  py-3 sm:grow-0"
          onClick={() => router.push('/profile/expertise')}
        >
          成為 Mentor
        </Button>
        <Button
          variant="default"
          className="grow rounded-full px-6 py-3 sm:grow-0"
        >
          開始探索 X-Talent
        </Button>
      </div>
    </div>
  );
}

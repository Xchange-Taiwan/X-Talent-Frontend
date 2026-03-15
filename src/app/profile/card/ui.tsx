'use client';

import { ProfileCard } from '@/components/profile/profile-card';
import { Button } from '@/components/ui/button';
import { UserType } from '@/hooks/user/user-data/useUserData';

interface Props {
  userData: UserType;
  isMentor: boolean;
  linkedinUrl: string;
  onBecomeMentor: () => void;
  onGoToMentorPool: () => void;
  onBackToProfile: () => void;
}

export default function ProfileCardUI({
  userData,
  isMentor,
  linkedinUrl,
  onBecomeMentor,
  onGoToMentorPool,
  onBackToProfile,
}: Props) {
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
            onClick={onBecomeMentor}
          >
            成為 Mentor
          </Button>
          <Button
            variant="default"
            className="grow rounded-full px-6 py-3 sm:grow-0"
            onClick={onGoToMentorPool}
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
            onClick={onBackToProfile}
          >
            Back to my profile
          </Button>
        </div>
      )}
    </div>
  );
}

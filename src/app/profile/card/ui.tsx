'use client';

import { ProfileCard } from '@/components/profile/profile-card';
import { MentorWelcomeFlipCard } from '@/components/profile/welcome-card';
import { Button } from '@/components/ui/button';
import { UserType } from '@/hooks/user/user-data/useUserData';
import type { PersonalLink } from '@/lib/profile/socialLinks';

interface Props {
  userData: UserType;
  isMentor: boolean;
  personalLinks?: PersonalLink[];
  onBecomeMentor: () => void;
  onGoToMentorPool: () => void;
  onBackToProfile: () => void;
  onSetupSchedule?: () => void;
}

export default function ProfileCardUI({
  userData,
  isMentor,
  personalLinks,
  onBecomeMentor,
  onGoToMentorPool,
  onBackToProfile,
  onSetupSchedule,
}: Props) {
  const resolvedPersonalLinks = personalLinks ?? userData.personalLinks;

  if (isMentor) {
    return (
      <div className="mx-auto w-11/12 max-w-[630px] pt-10 pb-20">
        <div className="text-center">
          <h1 className="text-text-primary mb-3 text-3xl font-bold sm:text-4xl">
            Mentor 資料已建立完成
          </h1>
          <p className="text-text-secondary text-base">
            歡迎加入 X-Talent！點擊下方小卡可翻面查看歡迎訊息。
          </p>
        </div>

        <div className="py-10">
          <MentorWelcomeFlipCard userData={userData} />
        </div>

        <section
          aria-label="開放可預約時段"
          className="border-background-border bg-background-white mx-auto max-w-[460px] rounded-2xl border p-6 text-center shadow-sm"
        >
          <h3 className="text-text-primary mb-2 text-lg font-bold">
            開放可預約時段
          </h3>
          <p className="text-text-secondary mb-5 text-sm">
            設定你的可預約時段，讓學員可以向你預約一對一交流。
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="default"
              className="rounded-full px-6 py-3"
              onClick={onSetupSchedule ?? onBackToProfile}
            >
              設定時段
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-6 py-3"
              onClick={onBackToProfile}
            >
              前往導師頁
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-11/12 max-w-[630px] pt-10 pb-20">
      <div className="text-center">
        <p className="mb-3 text-4xl font-bold">恭喜你完成個人頁面的建立！</p>
        <p className="text-base">
          現在你可以開始探索導師，或只需一步即可建立你的導師檔案
        </p>
      </div>

      <div className="py-10">
        <ProfileCard
          name={userData.name}
          avatarImgUrl={userData.avatar}
          company={userData.company}
          jobTitle={userData.job_title}
          personalLinks={resolvedPersonalLinks}
          interestedRole={userData.want_position}
          skillEnhancementTarget={userData.want_skill}
          talkTopic={userData.want_topic}
        />
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant="outline"
          className="grow rounded-full px-6 py-3 sm:grow-0"
          onClick={onBecomeMentor}
        >
          成為導師
        </Button>
        <Button
          variant="default"
          className="grow rounded-full px-6 py-3 sm:grow-0"
          onClick={onGoToMentorPool}
        >
          開始探索 X-Talent
        </Button>
      </div>
    </div>
  );
}

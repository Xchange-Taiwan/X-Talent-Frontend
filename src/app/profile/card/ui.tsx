'use client';

import { Calendar, Check } from 'lucide-react';

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
  onEditProfile?: () => void;
}

export default function ProfileCardUI({
  userData,
  isMentor,
  personalLinks,
  onBecomeMentor,
  onGoToMentorPool,
  onBackToProfile,
  onSetupSchedule,
  onEditProfile,
}: Props) {
  const resolvedPersonalLinks = personalLinks ?? userData.personalLinks;

  if (isMentor) {
    return (
      <div className="mx-auto w-11/12 max-w-[630px] pt-10 pb-20">
        <div className="flex items-center justify-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="bg-brand-50 text-brand-700 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <Check className="size-4 stroke-[2.5]" />
          </span>
          <h1 className="text-text-primary text-2xl font-bold sm:text-3xl">
            Mentor 資料已建立完成
          </h1>
        </div>

        <div className="py-8">
          <MentorWelcomeFlipCard
            userData={userData}
            onEditProfile={onEditProfile}
          />
        </div>

        <div className="border-background-border mx-auto mb-6 max-w-[560px] border-t" />

        <section
          aria-label="開放可預約時段"
          className="border-brand-100 bg-brand-50/70 mx-auto flex max-w-[560px] flex-col items-center justify-between gap-4 rounded-2xl border px-6 py-4 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="border-background-border bg-background-white text-text-secondary grid size-9 shrink-0 place-items-center rounded-full border"
            >
              <Calendar className="size-4" />
            </span>
            <h3 className="text-text-primary text-base font-bold">
              開放可預約時段
            </h3>
          </div>
          <Button
            variant="default"
            className="rounded-lg px-5 py-2.5 font-semibold"
            onClick={onSetupSchedule ?? onBackToProfile}
          >
            設定時段
          </Button>
        </section>

        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            className="text-text-secondary hover:text-text-primary rounded-lg px-4 py-2 text-sm font-medium"
            onClick={onBackToProfile}
          >
            前往導師頁
          </Button>
        </div>
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

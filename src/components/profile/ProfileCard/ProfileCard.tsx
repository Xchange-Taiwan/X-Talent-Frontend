'use client';

import type { FC, ReactNode } from 'react';

import { InterestType } from '@/hooks/user/userData/useUserData';

import { AvatarCard } from '../AvatarCard';

const SubTitle: FC<{ children: ReactNode }> = ({ children }) => {
  return <h2 className="mb-3 text-base font-bold">{children}</h2>;
};

const Tag: FC<{ displayText: string }> = ({ displayText }) => {
  if (!displayText) return null;

  return (
    <div className="border-neutral-300 rounded-xl border px-4 py-2">
      {displayText}
    </div>
  );
};

type Props = {
  name: string;
  avatarImgUrl?: string;
  jobTitle?: string;
  company?: string;
  linkedinUrl?: string;

  interestedRole?: InterestType[];
  skillEnhancementTarget?: InterestType[];
  talkTopic?: InterestType[];
  expertise?: InterestType[];
  whatIOffer?: InterestType[];
};

function renderTagList(
  title: string,
  items?: InterestType[],
  keyPrefix?: string
) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const prefix = keyPrefix ?? title;

  return (
    <div>
      <SubTitle>{title}</SubTitle>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Tag
            key={`${prefix}-${item.subject_group}`}
            displayText={item.subject}
          />
        ))}
      </div>
    </div>
  );
}

export const ProfileCard: FC<Props> = ({
  name,
  avatarImgUrl,
  company,
  jobTitle,
  linkedinUrl,
  interestedRole,
  skillEnhancementTarget,
  talkTopic,
  expertise,
  whatIOffer,
}) => {
  return (
    <div className="overflow-hidden rounded-2xl shadow-xl">
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]">
        <AvatarCard
          className="absolute -bottom-56 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:-bottom-40 sm:left-[180px]"
          name={name}
          avatarImgUrl={avatarImgUrl}
          jobTitle={jobTitle}
          companyName={company}
          linkedinUrl={linkedinUrl}
        />
      </div>

      <div className="bg-bright flex flex-col gap-10 px-4 pb-10 pt-[165px] sm:px-10 sm:pt-[132px]">
        {renderTagList('有興趣多了解的職位', interestedRole, 'interestedRole')}
        {renderTagList('想多了解、加強的技能', skillEnhancementTarget, 'skill')}
        {renderTagList('想多了解的主題', talkTopic, 'topic')}
        {renderTagList('專業能力', expertise, 'expertise')}
        {renderTagList('我能提供的服務', whatIOffer, 'whatIOffer')}
      </div>
    </div>
  );
};

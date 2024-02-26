'use Client';
import Image from 'next/image';
import type { FC, ReactNode } from 'react';

import { LinkedinColor } from '@/components/Icon';
import {
  InterestedRoleEnum,
  SkillEnhancementTargetEnum,
  talkTopicEnum,
} from '@/components/onboarding/Steps/constant';

const SubTitle: FC<{ children: ReactNode }> = ({ children }) => {
  return <h2 className="mb-3 text-base font-bold">{children}</h2>;
};

const Tag: FC<{
  enumKey: string;
  enumObj: Record<string, string>;
}> = ({ enumKey, enumObj }) => {
  const displayText = enumObj[enumKey as keyof typeof enumObj];

  if (!displayText) return null;

  return (
    <div className="border-neutral-300 rounded-xl border px-4 py-2">
      {displayText}
    </div>
  );
};

interface Props {
  name: string;
  avatarImgUrl?: string;
  jobTitle?: string;
  company?: string;
  linkedinUrl?: string;
  interestedRole?: string[];
  skillEnhancementTarget?: string[];
  talkTopic?: string[];
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
}) => {
  const handleNavigateToLinkedin = () => {
    window.open(linkedinUrl, '_blank');
  };

  return (
    <div className="overflow-hidden rounded-2xl shadow-xl">
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]">
        <div className="absolute -bottom-56 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6 sm:-bottom-40 sm:left-[180px] sm:flex-row">
          <div className="relative h-[120px] w-[120px] overflow-hidden rounded-full bg-brand-200">
            <Image
              src={avatarImgUrl || '/default-avatar.jpeg'}
              alt={'Avatar of ' + name}
              fill
              style={{
                objectFit: 'contain',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-base font-bold sm:text-2xl">{name}</h1>

              <LinkedinColor
                className="h-5 w-5 cursor-pointer sm:h-6 sm:w-6"
                onClick={handleNavigateToLinkedin}
              />
            </div>
            <p className="text-sm">
              {jobTitle} <span className="text-text-tertiary">at</span>{' '}
              {company}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-bright flex flex-col gap-10 px-4 pb-10 pt-[165px] sm:px-10 sm:pt-[132px]">
        {Array.isArray(interestedRole) && interestedRole.length > 0 && (
          <div>
            <SubTitle>有興趣多了解的職位</SubTitle>
            <div className="flex flex-wrap gap-2">
              {interestedRole.map((role) => (
                <Tag
                  key={`interestedRole ${role}`}
                  enumKey={role}
                  enumObj={InterestedRoleEnum}
                />
              ))}
            </div>
          </div>
        )}

        {Array.isArray(skillEnhancementTarget) &&
          skillEnhancementTarget.length > 0 && (
            <div>
              <SubTitle>想多了解、加強的技能</SubTitle>
              <div className="flex flex-wrap gap-2">
                {skillEnhancementTarget.map((target) => (
                  <Tag
                    key={`skillEnhancementTarget ${target}`}
                    enumKey={target}
                    enumObj={SkillEnhancementTargetEnum}
                  />
                ))}
              </div>
            </div>
          )}

        {Array.isArray(talkTopic) && talkTopic.length > 0 && (
          <div>
            <SubTitle>想多了解的主題</SubTitle>
            <div className="flex flex-wrap gap-2">
              {talkTopic.map((topic) => (
                <Tag
                  key={`talkTopic ${topic}`}
                  enumKey={topic}
                  enumObj={talkTopicEnum}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

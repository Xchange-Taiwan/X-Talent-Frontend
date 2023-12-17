'use Client';
import type { FC, ReactNode } from 'react';

import {
  CorporateFareSolid,
  LinkedinColor,
  PlaceSolid,
  SchoolSolid,
  ShareSolid,
} from '@/components/Icon';
import {
  InterestedRoleEnum,
  SkillEnhancementTargetEnum,
  talkTopicEnum,
} from '@/components/onboarding/Steps/constant';
import { useToast } from '@/components/ui/use-toast';

import { Avatar } from '../Avatar';

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
    <div className="rounded-xl border border-neutral-300 px-4 py-2">
      {displayText}
    </div>
  );
};

interface Props {
  name: string;
  region: string;
  avatarImgUrl?: string;
  jobTitle?: string;
  company?: string;
  school?: string;
  linkedinUrl?: string;
  interestedRole?: string[];
  skillEnhancementTarget?: string[];
  talkTopic?: string[];
}

export const ProfileCard: FC<Props> = ({
  name,
  region,
  avatarImgUrl,
  company,
  jobTitle,
  school,
  linkedinUrl,
  interestedRole,
  skillEnhancementTarget,
  talkTopic,
}) => {
  const { toast } = useToast();

  const handleCopyCurrentLink = async () => {
    const pageLink = window.location.href;

    try {
      await navigator.clipboard.writeText(pageLink);
      toast({
        variant: 'success',
        description: '複製網址成功，分享給朋友吧！',
        duration: 1000,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        description: '複製網址失敗',
        duration: 1000,
      });
    }
  };

  return (
    <div className="mx-auto w-11/12 max-w-[550px] overflow-hidden rounded-2xl shadow-xl">
      <div className="relative h-[120px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4]">
        <div className="absolute -bottom-10 left-1/2 h-[120px] w-[120px] -translate-x-1/2 rounded-full border-4 border-white">
          <Avatar imgUrl={avatarImgUrl} />
        </div>
      </div>
      <div className="bg-light flex flex-col gap-10 px-5 pb-6 pt-12 sm:px-10">
        <div className="border-b border-gray-200">
          <div className="text-center">
            <h1 className="pb-1 text-2xl font-bold">{name}</h1>

            {region && (
              <p className="flex items-center justify-center gap-1 text-base text-gray-500">
                <PlaceSolid />
                {region}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 py-5 text-sm sm:flex-row">
            {(company || jobTitle) && (
              <div className="flex flex-1 items-center gap-2">
                <div className="rounded-md bg-[#EBFBFB] p-1.5">
                  <CorporateFareSolid />
                </div>
                {company && <span>{company}</span>}
                {jobTitle && <span className="font-bold">{jobTitle}</span>}
              </div>
            )}

            {school && (
              <div className="flex flex-1 items-center gap-2">
                <div className="rounded-md bg-[#EBFBFB] p-1.5">
                  <SchoolSolid />
                </div>
                <span>{school}</span>
              </div>
            )}
          </div>
        </div>

        {Array.isArray(interestedRole) && interestedRole.length > 0 && (
          <div>
            <SubTitle>有興趣的職位及領域</SubTitle>
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
              <SubTitle>想精進的能力</SubTitle>
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
            <SubTitle>想聊聊的主題</SubTitle>
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

        <div className="flex justify-center gap-6">
          {linkedinUrl && (
            <a
              className="flex cursor-pointer gap-1 text-sm font-medium text-[#0A66C2]"
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkedinColor />
              <span>LinkedIn個人檔案</span>
            </a>
          )}

          <p
            className="flex cursor-pointer gap-1 text-sm  font-medium text-[#0A66C2]"
            onClick={handleCopyCurrentLink}
          >
            <ShareSolid />
            <span>分享個人名片</span>
          </p>
        </div>
      </div>
    </div>
  );
};

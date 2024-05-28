'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import DefaultAvatarImgUrl from '@/assets/default-avatar.jpeg';
import { LinkedinColor } from '@/components/Icon';
import { Button } from '@/components/ui/button';

const PROFILE_DATA = {
  name: 'Kim Jae-hoon',
  avatarImgUrl: undefined,
  jobTitle: 'Strategy Consultant',
  companyName: 'BrightPath Consulting',
  linkedinUrl: 'https://www.linkedin.com/in/cheng-yi-lin/',
};

export default function Page({
  params: { userId },
}: {
  params: { userId: string };
}) {
  const router = useRouter();

  // TODO: 待處理依據 userId 取資料邏輯
  console.info('userId', userId);

  const { name, avatarImgUrl, jobTitle, companyName } = PROFILE_DATA;

  return (
    <div>
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]" />

      <div className="container">
        <div className="mb-10 flex h-auto -translate-y-10 flex-col justify-between sm:relative sm:h-[160px] sm:flex-row lg:static">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-[160px] w-[160px] flex-shrink-0 overflow-hidden rounded-full bg-background-white">
              <Image
                src={avatarImgUrl || DefaultAvatarImgUrl}
                alt={'Avatar of ' + name}
                fill
                style={{
                  objectFit: 'contain',
                }}
              />
            </div>

            <div className="sm:mb-6 lg:mb-0">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <p className="text-2xl font-semibold">{name}</p>
                <LinkedinColor className="h-5 w-5 cursor-pointer sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-sm">
                  {jobTitle} <span className="text-text-tertiary">at</span>{' '}
                  {companyName}
                </p>
              </div>
            </div>
          </div>

          <div className="static mt-4 flex items-center justify-center gap-4 sm:absolute sm:bottom-0 sm:left-[184px] sm:mt-0 lg:static">
            <Button
              variant="outline"
              className="grow rounded-full px-6  py-3 sm:grow-0"
              onClick={() => router.push(`/profile/${userId}/edit`)}
            >
              編輯個人資訊
            </Button>
            <Button
              variant="default"
              className="grow rounded-full px-6 py-3 sm:grow-0"
            >
              預約設定
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

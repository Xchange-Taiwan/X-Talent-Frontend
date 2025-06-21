'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.jpeg';
import { LinkedinColor } from '@/components/Icon';
import { ExpertiseSelectItem } from '@/components/profile/ExpertiseSelectItem';
import { Button } from '@/components/ui/button';

const PROFILE_DATA = {
  name: 'Kim Jae-hoon',
  avatarImgUrl: undefined,
  jobTitle: 'Strategy Consultant',
  companyName: 'BrightPath Consulting',
  linkedinUrl: 'https://www.linkedin.com/in/cheng-yi-lin/',
};

const EXPERTISE_SELECTION = [
  'UI Design',
  'UX Design',
  'SEO Writing',
  'Graphic Design',
] as const;

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const router = useRouter();

  const [isLogging, setIsLogging] = useState(false);
  const [loginUserId, setLoginUserId] = useState('');
  const [isMentee, setIsMentee] = useState(false);
  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;

      setIsLogging(!!user?.id);
      setLoginUserId(!!user?.id ? String(user?.id) : '');
      setIsMentee(user?.isMentor !== true);
      setIsMentor(user?.isMentor === true);
    };

    fetchSession();
  }, []);

  const { name, avatarImgUrl, jobTitle, companyName } = PROFILE_DATA;

  return (
    <div>
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]" />

      <div className="container mb-20 max-w-[1024px]">
        <div className="flex h-auto -translate-y-10 flex-col justify-between sm:relative sm:h-[160px] sm:flex-row lg:static">
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
            {isLogging && pageUserId === loginUserId && (
              <Button
                variant="outline"
                className="grow rounded-full px-6  py-3 sm:grow-0"
                onClick={() => router.push(`/profile/${pageUserId}/edit`)}
              >
                編輯個人資訊
              </Button>
            )}

            {isLogging && isMentee && pageUserId === loginUserId && (
              <Button
                variant="default"
                className="grow rounded-full px-6 py-3 sm:grow-0"
                onClick={() =>
                  router.push(`/profile/${pageUserId}/edit?onboarding=true`)
                }
              >
                變成導師
              </Button>
            )}

            {isLogging && isMentor && (
              <Button
                variant="default"
                className="grow rounded-full px-6 py-3 sm:grow-0"
              >
                預約設定
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-40">
          <div className="w-full lg:w-1/2">
            <div>
              <p className="mb-4 text-xl font-bold">關於我</p>
              <p className="text-sm text-gray-400">目前還沒有個人簡介</p>
            </div>
            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">專長領域</p>
              <div className="grid max-h-[600px] grid-cols-1 gap-4 overflow-scroll">
                {EXPERTISE_SELECTION.map((type) => (
                  <ExpertiseSelectItem key={type} type={type} />
                ))}
              </div>
            </div>
            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">工作經驗</p>
              <p className="text-sm text-gray-400">目前還沒有工作經驗</p>
            </div>
            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">教育</p>
              <p className="text-sm text-gray-400">目前還沒有教育</p>
            </div>
          </div>

          <div className="hidden w-1/2 lg:block">
            <div>
              <p className="mb-4 text-xl font-bold">可預約時段</p>
              <p className="text-sm text-gray-400">目前沒有可預約時段</p>
            </div>
            <Button
              variant="default"
              className="mt-5 w-2/3 rounded-full px-6 py-3"
            >
              預約設定
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.jpeg';
import { LinkedinColor } from '@/components/Icon';
import { ExperienceSection } from '@/components/profile/ExperienceSection/ExperienceSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchUser } from '@/services/profile/user';
import { UserType } from '@/services/profile/user';

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
  const [userData, setUserData] = useState<UserType | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;

      setIsLogging(!!user?.id);
      setLoginUserId(!!user?.id ? String(user?.id) : '');
    };

    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (data) {
          setUserData(data);
          setIsMentor(data.is_mentor);
          setIsMentee(!data.is_mentor);
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      }
    }

    fetchSession();
    fetchUserData();
  }, []);

  const firstWorkExperience = userData?.experiences?.find(
    (exp) => (exp.category as string) === 'WORK',
  );

  const metadata = firstWorkExperience?.mentor_experiences_metadata as {
    company?: string;
    job?: string;
  };

  const firstWorkExperienceCompany = metadata?.company || '';
  const firstWorkExperienceTitle = metadata?.job || '';

  const parsedExperiences =
    userData?.experiences
      ?.filter((e) => e.category === 'WORK')
      .map((e) => {
        const metadata = e.mentor_experiences_metadata as {
          job?: string;
          company?: string;
          jobPeriodStart?: string;
          jobPeriodEnd?: string;
          description?: string;
        };
        return {
          title: metadata.job || '',
          subtitle: metadata.company || '',
          description: metadata.description || '',
          startDate: metadata.jobPeriodStart || '',
          endDate: metadata.jobPeriodEnd || '',
        };
      }) || [];

  const parsedEducations =
    userData?.experiences
      ?.filter((e) => e.category === 'EDUCATION')
      .map((e) => {
        const metadata = e.mentor_experiences_metadata as {
          school?: string;
          subject?: string;
          educationPeriodStart?: string;
          educationPeriodEnd?: string;
        };
        return {
          title: metadata.subject || '',
          subtitle: metadata.school || '',
          startDate: metadata.educationPeriodStart || '',
          endDate: metadata.educationPeriodEnd || '',
        };
      }) || [];

  if (!userData) {
    return null;
  }

  return (
    <div>
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]" />

      <div className="container mb-20 max-w-[1024px]">
        <div className="flex h-auto -translate-y-10 flex-col justify-between sm:relative sm:h-[160px] sm:flex-row lg:static">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-[160px] w-[160px] flex-shrink-0 overflow-hidden rounded-full bg-background-white">
              <Image
                src={userData?.avatar || DefaultAvatarImgUrl}
                alt={'Avatar of ' + userData?.name}
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="sm:mb-6 lg:mb-0">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <p className="text-2xl font-semibold">{userData?.name}</p>
                <LinkedinColor className="h-5 w-5 cursor-pointer sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-sm">
                  {firstWorkExperienceTitle}{' '}
                  <span className="text-text-tertiary">at</span>{' '}
                  {firstWorkExperienceCompany}
                </p>
              </div>
            </div>
          </div>

          <div className="static mt-4 flex items-center justify-center gap-4 sm:absolute sm:bottom-0 sm:left-[184px] sm:mt-0 lg:static">
            {isLogging && pageUserId === loginUserId && (
              <Button
                variant="outline"
                className="grow rounded-full px-6 py-3 sm:grow-0"
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
          </div>
        </div>

        <div className="flex gap-40">
          <div className="w-full">
            <div>
              <p className="mb-4 text-xl font-bold">關於我</p>
              <p className="text-sm text-gray-400">{userData?.about}</p>
            </div>

            {isMentor && (
              <div className="mt-10">
                <p className="mb-4 text-xl font-bold">專業能力</p>
                <div className="flex gap-3">
                  {userData?.expertises?.professions?.map((i) => (
                    <Badge variant={'primaryAlt'} key={i.subject_group}>
                      {i.subject_group}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {isMentor && (
              <div className="mt-10">
                <p className="mb-4 text-xl font-bold">我能提供的服務</p>
                <Badge variant={'primaryAlt'}>空格</Badge>
              </div>
            )}

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">專長領域</p>
              <div className="flex gap-3">
                {userData?.expertises?.professions?.map((i) => (
                  <Badge variant={'primaryAlt'} key={i.subject_group}>
                    {i.subject_group}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">有興趣的職位</p>
              <div className="flex gap-3">
                {userData?.interested_positions?.interests?.map((i) => (
                  <Badge variant={'primaryAlt'} key={i.subject_group}>
                    {i.subject_group}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">有興趣的技能</p>
              <div className="flex gap-3">
                {userData?.skills?.interests?.map((i) => (
                  <Badge variant={'primaryAlt'} key={i.subject_group}>
                    {i.subject_group}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">有興趣的主題</p>
              <div className="flex gap-3">
                {userData?.topics?.interests?.map((i) => (
                  <Badge variant={'primaryAlt'} key={i.subject_group}>
                    {i.subject_group}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">工作經驗</p>
              <ExperienceSection items={parsedExperiences} />
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">教育</p>
              <ExperienceSection items={parsedEducations} />
            </div>
          </div>

          <div className="hidden w-1/2 lg:block">
            {isMentor && (
              <div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

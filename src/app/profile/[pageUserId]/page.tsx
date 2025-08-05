'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.jpeg';
import { ExperienceSection } from '@/components/profile/ExperienceSection/ExperienceSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import useMentorSchedule, {
  dummyRawTimeslots,
} from '@/hooks/useMentorSchedule';
import { fetchUserById } from '@/services/profile/user';
import { UserType } from '@/services/profile/user';

type WorkExperienceMetadata = {
  job?: string;
  company?: string;
  jobPeriodStart?: string;
  jobPeriodEnd?: string;
  description?: string;
};

type WorkExperience = {
  category: string;
  mentor_experiences_metadata?: {
    data: WorkExperienceMetadata[];
  };
};

type EducationExperienceMetadata = {
  subject?: string;
  school?: string;
  educationPeriodStart?: string;
  educationPeriodEnd?: string;
};

type WhatIOfferMetadata = {
  subject_group: string;
};

type PersonalLinkMetadata = {
  platform: string;
  url: string;
};

const platformLabelMap: Record<string, { label: string; icon: JSX.Element }> = {
  linkedin: {
    label: 'LinkedIn',
    icon: (
      <Image
        src="/profile/edit/linkedin-logo.svg"
        alt="LinkedIn"
        width={20}
        height={20}
      />
    ),
  },
  facebook: {
    label: 'Facebook',
    icon: (
      <Image
        src="/profile/edit/facebook-logo.svg"
        alt="Facebook"
        width={20}
        height={20}
      />
    ),
  },
  instagram: {
    label: 'Instagram',
    icon: (
      <Image
        src="/profile/edit/instagram-logo.svg"
        alt="Instagram"
        width={20}
        height={20}
      />
    ),
  },
  twitter: {
    label: 'X (formerly Twitter)',
    icon: (
      <Image
        src="/profile/edit/twitter-logo.svg"
        alt="Twitter"
        width={20}
        height={20}
      />
    ),
  },
  youtube: {
    label: 'YouTube',
    icon: (
      <Image
        src="/profile/edit/youtube-logo.svg"
        alt="YouTube"
        width={20}
        height={20}
      />
    ),
  },
  website: {
    label: '個人網站',
    icon: (
      <Image
        src="/profile/edit/website-logo.svg"
        alt="Website"
        width={20}
        height={20}
      />
    ),
  },
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;

      setIsLogging(!!user?.id);
      setLoginUserId(!!user?.id ? String(user?.id) : '');
    };

    fetchSession();
  }, []);

  useEffect(() => {
    const userId = Number(pageUserId);
    if (!userId || isNaN(userId)) return;

    const fetchUserData = async () => {
      setLoading(true);
      try {
        const data = await fetchUserById(userId, 'zh_TW');
        if (data) {
          setUserData(data);
          setIsMentor(data.is_mentor);
          setIsMentee(!data.is_mentor);
        }
      } catch (err) {
        console.error('Fetch User Data Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [pageUserId]);

  // Dummy calendar data
  const parsedTimeslots = useMentorSchedule(dummyRawTimeslots);
  console.log(parsedTimeslots);

  if (loading) {
    return null;
  }

  if (!userData) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-gray-500">
        沒有該位使用者
      </div>
    );
  }

  const firstWorkExperience = userData?.experiences?.find(
    (exp) => exp.category === 'WORK'
  ) as WorkExperience;

  const firstWorkMetadataList =
    firstWorkExperience?.mentor_experiences_metadata?.data;

  const firstWorkMetadata = Array.isArray(firstWorkMetadataList)
    ? firstWorkMetadataList[0]
    : undefined;

  const firstWorkExperienceCompany = firstWorkMetadata?.company || '';
  const firstWorkExperienceTitle = firstWorkMetadata?.job || '';

  const parsedExperiences =
    userData?.experiences
      ?.filter((e) => e.category === 'WORK')
      .flatMap((e) => {
        const metadataArray =
          (e.mentor_experiences_metadata as { data?: WorkExperienceMetadata[] })
            ?.data ?? [];
        return metadataArray.map((meta) => ({
          title: meta.job || '',
          subtitle: meta.company || '',
          description: meta.description || '',
          startDate: meta.jobPeriodStart || '',
          endDate: meta.jobPeriodEnd || '',
        }));
      }) || [];

  const parsedEducations =
    userData?.experiences
      ?.filter((e) => e.category === 'EDUCATION')
      .flatMap((e) => {
        const metadataArray =
          (
            e.mentor_experiences_metadata as {
              data?: EducationExperienceMetadata[];
            }
          )?.data ?? [];
        return metadataArray.map((meta) => ({
          title: meta.subject || '',
          subtitle: meta.school || '',
          startDate: meta.educationPeriodStart || '',
          endDate: meta.educationPeriodEnd || '',
        }));
      }) || [];

  const parsedWhatIOffer =
    userData?.experiences
      ?.filter((e) => e.category === 'WHAT_I_OFFER')
      .flatMap((e) => {
        const metadataArray =
          (e.mentor_experiences_metadata as { data?: WhatIOfferMetadata[] })
            ?.data ?? [];
        return metadataArray.map((meta) => meta.subject_group);
      }) || [];

  const personalLinks =
    userData?.experiences
      ?.filter((e) => e.category === 'LINK')
      .flatMap((e) => {
        const metadataArray =
          (e.mentor_experiences_metadata as { data?: PersonalLinkMetadata[] })
            ?.data ?? [];
        return metadataArray.filter((link) => link.url);
      }) || [];

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
                {personalLinks.map((link) => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 text-gray-600"
                    title={
                      platformLabelMap[link.platform]?.label || link.platform
                    }
                  >
                    {platformLabelMap[link.platform]?.icon}
                  </a>
                ))}
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

            {isMentor && parsedWhatIOffer.length > 0 && (
              <div className="mt-10">
                <p className="mb-4 text-xl font-bold">我能提供的服務</p>
                <div className="flex flex-wrap gap-3">
                  {parsedWhatIOffer.map((subjectGroup) => (
                    <Badge variant={'primaryAlt'} key={subjectGroup}>
                      {subjectGroup}
                    </Badge>
                  ))}
                </div>
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

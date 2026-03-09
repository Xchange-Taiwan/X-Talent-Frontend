'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import {
  EducationSection,
  WorkExperienceSection,
} from '@/components/profile/experience-section/ExperienceSection';
import MenteeReservationDialog from '@/components/profile/reservation/MenteeReservationDialog';
import MentorScheduleDialog from '@/components/profile/reservation/MentorScheduleDialog';
import { ScheduleCalendar } from '@/components/profile/reservation/ScheduleCalendar';
import { platformLabelMap } from '@/components/profile/social-links/platformLabelMap';
import { ProfileBadgeSection } from '@/components/profile/view/ProfileBadgeSection';
import { Button } from '@/components/ui/button';
import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import useUserData from '@/hooks/user/user-data/useUserData';
import {
  formatSelectedDate,
  formatStartTimeSlot,
  toDateKey,
} from '@/lib/profile/scheduleFormatters';

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const router = useRouter();

  const schedule = useMentorSchedule({
    storageKey: `mentor.timeslots:${pageUserId}`,
  });
  const {
    loaded,
    selectedDate,
    setSelectedDate,
    draftForSelectedDate,
    parsedDraft,
  } = schedule;
  const [isLogging, setIsLogging] = useState(false);
  const [loginUserId, setLoginUserId] = useState('');

  const [avatarCacheBust] = useState(() => Date.now());
  const [openReservationDialog, setOpenReservationDialog] = useState(false);
  const [openMenteeReservationDialog, setOpenMenteeReservationDialog] =
    useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const session = await getSession();
      const user = session?.user;

      setIsLogging(!!user?.id);
      setLoginUserId(!!user?.id ? String(user?.id) : '');
    };

    fetchSession();
  }, []);

  const pageUserIdNumber = Number(pageUserId);
  const { userData, isLoading: loading } = useUserData(
    pageUserIdNumber,
    'zh_TW'
  );

  if (loading || !loaded) {
    return null;
  }

  if (!userData) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-gray-500">
        沒有該位使用者
      </div>
    );
  }

  const reservationHandler = () => {
    if (!loginUserId) {
      router.push('/auth/signin');
      return;
    }
    if (userData.is_mentor && pageUserId === loginUserId) {
      setOpenReservationDialog(true);
      return;
    }
    if (userData.is_mentor && pageUserId !== loginUserId) {
      setOpenMenteeReservationDialog(true);
      return;
    }
  };

  const allowedDates = parsedDraft
    .filter((slot) => slot.type === 'ALLOW')
    .map((slot) => slot.dateKey);

  return (
    <div>
      <div className="relative h-[111px] bg-gradient-to-br from-[#92e7e7] to-[#e7a0d4] sm:h-[100px]" />

      <div className="container mb-20 max-w-[1024px]">
        <div className="flex h-auto -translate-y-10 flex-col justify-between sm:relative sm:h-[160px] sm:flex-row lg:static">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-[160px] w-[160px] flex-shrink-0 overflow-hidden rounded-full bg-background-white">
              <Image
                src={
                  userData?.avatar
                    ? `${userData.avatar}?cb=${avatarCacheBust}`
                    : DefaultAvatarImgUrl
                }
                alt={'Avatar of ' + userData?.name}
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="sm:mb-6 lg:mb-0">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <p className="text-2xl font-semibold">{userData?.name}</p>
                {userData?.personalLinks?.map((link) => (
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
                  {userData.job_title}{' '}
                  <span className="text-text-tertiary">at</span>{' '}
                  {userData.company}
                </p>
              </div>
            </div>
          </div>

          <div className="static mt-4 flex items-center justify-center gap-4 sm:absolute sm:bottom-0 sm:left-[184px] sm:mt-0 lg:static">
            {isLogging && pageUserId === loginUserId && (
              <>
                <Button
                  variant="outline"
                  className="grow rounded-full px-6 py-3 sm:grow-0"
                  onClick={() => router.push(`/profile/${pageUserId}/edit`)}
                >
                  編輯個人資訊
                </Button>
                <Button
                  className="grow rounded-full px-6 py-3 sm:grow-0 lg:hidden"
                  onClick={() => reservationHandler()}
                >
                  預約設定
                </Button>
              </>
            )}

            {isLogging && !userData.is_mentor && pageUserId === loginUserId && (
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

        <div className="flex gap-12 ">
          <div className="w-3/5">
            <div>
              <p className="mb-4 text-xl font-bold">關於我</p>
              <p className="text-sm text-gray-400">{userData?.about}</p>
            </div>

            {userData.is_mentor && (
              <ProfileBadgeSection
                title="專業能力"
                items={userData?.expertises ?? []}
              />
            )}

            {userData.is_mentor && (
              <ProfileBadgeSection
                title="我能提供的服務"
                items={userData?.what_i_offers ?? []}
              />
            )}

            <ProfileBadgeSection
              title="有興趣多了解的職位"
              items={userData?.interested_positions ?? []}
            />

            <ProfileBadgeSection
              title="想多了解、加強的技能"
              items={userData?.skills ?? []}
            />

            <ProfileBadgeSection
              title="想多了解的主題"
              items={userData?.topics ?? []}
            />

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">工作經驗</p>
              <WorkExperienceSection
                workExperiences={userData?.workExperiences}
              />
            </div>

            <div className="mt-10">
              <p className="mb-4 text-xl font-bold">教育</p>
              <EducationSection educations={userData?.educations} />
            </div>
          </div>

          <div className="hidden w-2/5 lg:block">
            {userData.is_mentor && (
              <div className="flex w-full flex-col gap-4">
                <p className="text-xl font-bold">可預約日期</p>

                <div className="inline-block w-auto rounded-lg border p-2 shadow-md">
                  <div className="px-3 pb-3 pt-1">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {formatSelectedDate(
                        selectedDate ? new Date(selectedDate) : undefined
                      )}
                    </h2>
                  </div>
                  <ScheduleCalendar
                    selected={
                      selectedDate ? new Date(selectedDate) : new Date()
                    }
                    onSelect={(d) => setSelectedDate(d ? toDateKey(d) : null)}
                    allowedDates={allowedDates}
                    showTodayStyle={false}
                    disableEmptyDates={true}
                  />
                </div>
                <div className="flex flex-col items-start gap-4">
                  <p>當日可預約時段</p>
                  {draftForSelectedDate.length === 0 ? (
                    <div className="flex min-h-10 items-center text-gray-400">
                      無可預約的時段
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {[...draftForSelectedDate]
                        .sort((a, b) => a.start.getTime() - b.start.getTime())
                        .map((slot) => (
                          <div
                            key={slot.id}
                            className="flex h-10 w-[140px] select-none items-center justify-center rounded-lg border border-[#E6E8EA] text-sm font-medium"
                          >
                            {formatStartTimeSlot(slot)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="default"
                  className="w-full rounded-full px-6 py-3"
                  onClick={reservationHandler}
                >
                  {loginUserId && userData.is_mentor
                    ? loginUserId === userData?.user_id.toString()
                      ? '預約設定'
                      : '預約時間'
                    : '預約時間'}
                </Button>
                {loginUserId === pageUserId ? (
                  <MentorScheduleDialog
                    open={openReservationDialog}
                    onOpenChange={setOpenReservationDialog}
                    schedule={schedule}
                  />
                ) : (
                  <MenteeReservationDialog
                    open={openMenteeReservationDialog}
                    onOpenChange={setOpenMenteeReservationDialog}
                    schedule={schedule}
                    userData={userData}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

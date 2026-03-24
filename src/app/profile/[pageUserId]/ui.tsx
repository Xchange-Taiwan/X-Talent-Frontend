'use client';

import Image from 'next/image';

import DefaultAvatarImgUrl from '@/assets/default-avatar.png';
import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
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
import { UseMentorScheduleReturn } from '@/hooks/useMentorSchedule';
import { UserType } from '@/hooks/user/user-data/useUserData';
import {
  formatBookingSlotTime,
  formatSelectedDate,
  toDateKey,
} from '@/lib/profile/scheduleFormatters';

import { ScheduleSkeleton } from './skeleton';

interface Props {
  userData: UserType;
  pageUserId: string;
  schedule: UseMentorScheduleReturn;
  scheduleLoaded: boolean;
  loginUserId: string;
  isLogging: boolean;
  avatarCacheBust: number;
  allowedDates: string[];
  openReservationDialog: boolean;
  setOpenReservationDialog: (open: boolean) => void;
  openMenteeReservationDialog: boolean;
  setOpenMenteeReservationDialog: (open: boolean) => void;
  onScheduleMonthChange: (date: Date) => void;
  onReservation: () => void;
  onEditProfile: () => void;
  onBecomeMentor: () => void;
}

export default function ProfilePageUI({
  userData,
  pageUserId,
  schedule,
  scheduleLoaded,
  loginUserId,
  isLogging,
  avatarCacheBust,
  allowedDates,
  openReservationDialog,
  setOpenReservationDialog,
  openMenteeReservationDialog,
  setOpenMenteeReservationDialog,
  onScheduleMonthChange,
  onReservation,
  onEditProfile,
  onBecomeMentor,
}: Props) {
  const { selectedDate, setSelectedDate, generateBookingSlots } = schedule;

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
                sizes="160px"
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="min-w-0 sm:mb-6 lg:mb-0">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <p className="break-words text-2xl font-semibold">
                  {userData?.name}
                </p>
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
              <Button
                variant="outline"
                className="grow rounded-full px-6 py-3 sm:grow-0"
                onClick={onEditProfile}
              >
                編輯個人資訊
              </Button>
            )}

            {isLogging && !userData.is_mentor && pageUserId === loginUserId && (
              <Button
                variant="default"
                className="grow rounded-full px-6 py-3 sm:grow-0"
                onClick={onBecomeMentor}
              >
                成為導師
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div className="w-full lg:w-3/5">
            <div>
              <p className="mb-4 text-xl font-bold">關於我</p>
              <p className="break-words text-sm text-gray-400">
                {userData?.about}
              </p>
              {(userData?.years_of_experience || userData?.industry) && (
                <div className="mt-4 flex flex-col gap-1 text-sm">
                  {userData.years_of_experience && (
                    <p>
                      <span className="font-medium">經驗：</span>
                      <span className="text-gray-400">
                        {TotalWorkSpanEnum[
                          userData.years_of_experience as keyof typeof TotalWorkSpanEnum
                        ] ?? userData.years_of_experience}
                      </span>
                    </p>
                  )}
                  {userData.industry && (
                    <p>
                      <span className="font-medium">產業：</span>
                      <span className="text-gray-400">{userData.industry}</span>
                    </p>
                  )}
                </div>
              )}
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

          {userData.is_mentor && (
            <div className="w-full lg:w-2/5">
              {!scheduleLoaded ? (
                <ScheduleSkeleton />
              ) : (
                <div className="flex w-full flex-col gap-4">
                  <p className="text-xl font-bold">可預約日期</p>

                  <div className="w-full rounded-lg border p-2 shadow-md">
                    <div className="px-3 pb-3 pt-1">
                      <h2 className="text-2xl font-semibold tracking-tight">
                        {formatSelectedDate(
                          selectedDate
                            ? new Date(selectedDate + 'T00:00:00')
                            : undefined
                        )}
                      </h2>
                    </div>
                    <ScheduleCalendar
                      selected={
                        selectedDate
                          ? new Date(selectedDate + 'T00:00:00')
                          : new Date()
                      }
                      onSelect={(d) => setSelectedDate(d ? toDateKey(d) : null)}
                      onMonthChange={onScheduleMonthChange}
                      allowedDates={allowedDates}
                      showTodayStyle={false}
                      disableEmptyDates={true}
                    />
                  </div>
                  <div className="flex flex-col items-start gap-4">
                    <p>當日可預約時段</p>
                    {(() => {
                      const slots = selectedDate
                        ? generateBookingSlots(selectedDate)
                        : [];
                      if (slots.length === 0) {
                        return (
                          <div className="flex min-h-10 items-center text-gray-400">
                            無可預約的時段
                          </div>
                        );
                      }
                      return (
                        <div className="grid w-full grid-cols-2 gap-2">
                          {slots.map((slot) => (
                            <div
                              key={slot.start.getTime()}
                              className="flex h-10 select-none items-center justify-center rounded-lg border border-[#E6E8EA] text-sm font-medium"
                            >
                              {formatBookingSlotTime(slot)}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <Button
                    variant="default"
                    className="w-full rounded-full px-6 py-3"
                    onClick={onReservation}
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
                      onMonthChange={onScheduleMonthChange}
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
          )}
        </div>
      </div>
    </div>
  );
}

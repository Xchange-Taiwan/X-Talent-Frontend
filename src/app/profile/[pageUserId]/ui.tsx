'use client';

import Image, { type StaticImageData } from 'next/image';

import {
  EducationSection,
  WorkExperienceSection,
} from '@/components/profile/experience-section/ExperienceSection';
import { ProfileBanner } from '@/components/profile/profile-banner';
import { BookingForm } from '@/components/profile/reservation/BookingForm';
import MentorScheduleDialog from '@/components/profile/reservation/MentorScheduleDialog';
import { ScheduleCalendar } from '@/components/profile/reservation/ScheduleCalendar';
import { platformLabelMap } from '@/components/profile/social-links/platformLabelMap';
import { ProfileBadgeSection } from '@/components/profile/view/ProfileBadgeSection';
import { Button } from '@/components/ui/button';
import {
  BookingSlot,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';
import { UserType } from '@/hooks/user/user-data/useUserData';
import {
  formatSelectedDate,
  toDateKey,
} from '@/lib/profile/scheduleFormatters';
import { isSafeUrl } from '@/lib/url/isSafeUrl';

import {
  ProfileContentSkeleton,
  ProfileHeaderSkeleton,
  ScheduleSkeleton,
} from './skeleton';

interface Props {
  userData: UserType | null;
  userLoading: boolean;
  pageUserId: string;
  schedule: UseMentorScheduleReturn;
  scheduleLoaded: boolean;
  loginUserId: string;
  isLogging: boolean;
  avatarSrc: string | StaticImageData;
  allowedDates: string[];
  openReservationDialog: boolean;
  setOpenReservationDialog: (open: boolean) => void;
  onScheduleMonthChange: (date: Date) => void;
  onReservation: () => void;
  onEditProfile: () => void;
  onBecomeMentor: () => void;
  selectedSlot: BookingSlot | null;
  setSelectedSlot: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  onConfirmReservation: (question?: string) => Promise<boolean>;
}

export default function ProfilePageUI({
  userData,
  userLoading,
  pageUserId,
  schedule,
  scheduleLoaded,
  loginUserId,
  isLogging,
  avatarSrc,
  allowedDates,
  openReservationDialog,
  setOpenReservationDialog,
  onScheduleMonthChange,
  onReservation,
  onEditProfile,
  onBecomeMentor,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  onConfirmReservation,
}: Props) {
  const { selectedDate, setSelectedDate, generateBookingSlots } = schedule;

  // Render the schedule region while user data loads (most profile views are
  // mentors) so the calendar can appear before user data resolves; collapse
  // it once the user is confirmed as a non-mentor.
  const showScheduleRegion = userLoading || userData?.is_mentor;
  const isOwnMentorProfile =
    !!userData &&
    userData.is_mentor &&
    loginUserId === userData.user_id.toString();

  return (
    <div>
      <ProfileBanner />

      <div className="container mb-20 max-w-screen-lg 2xl:max-w-screen-xl">
        {userLoading ? (
          <ProfileHeaderSkeleton />
        ) : userData ? (
          <div className="flex h-auto -translate-y-10 flex-col sm:flex-row sm:items-start">
            <div className="relative mx-auto h-[160px] w-[160px] flex-shrink-0 overflow-hidden rounded-full bg-background-white sm:mx-0">
              <Image
                src={avatarSrc}
                alt={'Avatar of ' + userData.name}
                fill
                sizes="160px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>

            <div className="flex min-w-0 flex-col items-center sm:mt-10 sm:ml-6 sm:items-start">
              <div className="mb-2 flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <p className="text-2xl font-semibold break-words">
                  {userData.name}
                </p>
                {!!userData.personalLinks?.length && (
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {userData.personalLinks
                      .filter((link) => isSafeUrl(link.url))
                      .map((link) => (
                        <a
                          key={link.platform}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-secondary hover:text-brand-500"
                          title={
                            platformLabelMap[link.platform]?.label ||
                            link.platform
                          }
                        >
                          {platformLabelMap[link.platform]?.icon}
                        </a>
                      ))}
                  </div>
                )}
              </div>
              {(userData.job_title || userData.company) && (
                <p className="text-sm">
                  {userData.job_title}
                  {userData.job_title && userData.company && (
                    <span className="text-text-tertiary"> at </span>
                  )}
                  {userData.company}
                </p>
              )}
              <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
                {isLogging && pageUserId === loginUserId && (
                  <Button
                    variant="outline"
                    className="grow rounded-full px-6 py-3 sm:grow-0"
                    onClick={onEditProfile}
                  >
                    編輯個人資訊
                  </Button>
                )}

                {isLogging &&
                  !userData.is_mentor &&
                  pageUserId === loginUserId && (
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
          </div>
        ) : null}

        <div className="flex flex-col gap-8 2xl:flex-row 2xl:gap-12">
          <div className="w-full 2xl:w-3/5">
            {userLoading ? (
              <ProfileContentSkeleton />
            ) : userData ? (
              <>
                {userData.about && (
                  <div>
                    <p className="mb-4 text-xl font-bold">關於我</p>
                    <p className="text-sm break-words text-text-tertiary">
                      {userData.about}
                    </p>
                  </div>
                )}

                <ProfileBadgeSection
                  title="經驗"
                  items={
                    userData.years_of_experience
                      ? [
                          {
                            subject_group: 'years_of_experience',
                            subject: userData.years_of_experience,
                          },
                        ]
                      : []
                  }
                />

                <ProfileBadgeSection
                  title="產業"
                  items={
                    userData.industry
                      ? [
                          {
                            subject_group: 'industry',
                            subject: userData.industry,
                          },
                        ]
                      : []
                  }
                />

                {userData.is_mentor && (
                  <ProfileBadgeSection
                    title="專業能力"
                    items={userData.have_skill}
                  />
                )}

                {userData.is_mentor && (
                  <ProfileBadgeSection
                    title="我能提供的服務"
                    items={userData.have_topic}
                  />
                )}

                <ProfileBadgeSection
                  title="有興趣多了解的職位"
                  items={userData.want_position}
                />

                <ProfileBadgeSection
                  title="想多了解、加強的技能"
                  items={userData.want_skill}
                />

                <ProfileBadgeSection
                  title="想多了解的主題"
                  items={userData.want_topic}
                />

                {!!userData.workExperiences?.length && (
                  <div className="mt-10">
                    <p className="mb-4 text-xl font-bold">工作經驗</p>
                    <WorkExperienceSection
                      workExperiences={userData.workExperiences}
                    />
                  </div>
                )}

                {!!userData.educations?.length && (
                  <div className="mt-10">
                    <p className="mb-4 text-xl font-bold">教育</p>
                    <EducationSection educations={userData.educations} />
                  </div>
                )}
              </>
            ) : null}
          </div>

          {showScheduleRegion && (
            <div className="w-full 2xl:w-2/5">
              {!scheduleLoaded ? (
                <ScheduleSkeleton />
              ) : (
                <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] 2xl:max-w-[414px]">
                  <div className="w-full rounded-2xl border border-background-border bg-background-white p-5 shadow-sm">
                    <div className="mb-3 border-b border-background-border pb-3">
                      <p className="mb-1 text-xs font-medium text-text-tertiary">
                        可預約日期
                      </p>
                      <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl 2xl:text-2xl">
                        {formatSelectedDate(
                          selectedDate
                            ? new Date(selectedDate + 'T00:00:00')
                            : undefined
                        )}
                      </h2>
                    </div>

                    <ScheduleCalendar
                      size="profile"
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
                      isMonthLoading={!schedule.monthLoaded}
                    />
                  </div>
                  <BookingForm
                    isOwnMentorProfile={isOwnMentorProfile}
                    isUserDataLoading={userLoading}
                    isAuthenticated={!!loginUserId}
                    slots={
                      selectedDate ? generateBookingSlots(selectedDate) : []
                    }
                    monthLoaded={schedule.monthLoaded}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                    isSubmitting={isSubmitting}
                    selectedDate={selectedDate}
                    onReservation={onReservation}
                    onConfirmReservation={onConfirmReservation}
                  />
                  {userData && loginUserId === pageUserId && (
                    <MentorScheduleDialog
                      open={openReservationDialog}
                      onOpenChange={setOpenReservationDialog}
                      schedule={schedule}
                      onMonthChange={onScheduleMonthChange}
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

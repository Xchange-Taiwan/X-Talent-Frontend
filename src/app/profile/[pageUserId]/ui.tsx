'use client';

import { Pencil } from 'lucide-react';
import Image, { type StaticImageData } from 'next/image';
import { useCallback, useMemo } from 'react';

import { MentorBookmarkButton } from '@/components/favorites';
import {
  EducationSection,
  WorkExperienceSection,
} from '@/components/profile/experience-section/ExperienceSection';
import {
  MentorFeedbackSection,
  MentorSummaryBar,
} from '@/components/profile/feedback';
import {
  MenteeProfileContent,
  MenteeSummaryBar,
  MenteeWatchedPositionsCard,
} from '@/components/profile/mentee';
import { ProfileBanner } from '@/components/profile/profile-banner';
import { BookingForm } from '@/components/profile/reservation/BookingForm';
import { ScheduleCalendar } from '@/components/profile/reservation/ScheduleCalendar';
import { PersonalLinksGrid } from '@/components/profile/social-links/PersonalLinksGrid';
import {
  type ResolvedDisplaySocialLink,
  resolveDisplaySocialLinks,
} from '@/components/profile/social-links/platformLabelMap';
import { ProfileBadgeSection } from '@/components/profile/view/ProfileBadgeSection';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenteeProfileView } from '@/hooks/profile/useMenteeProfileView';
import type { MentorFeedbackState } from '@/hooks/user/feedback/useMentorFeedback';
import { UserType } from '@/hooks/user/user-data/useUserData';
import { normalizeMentorFromProfile } from '@/lib/mentor/mentorCardModel';
import { BookingCalendarReader } from '@/lib/profile/bookingAvailability';
import type { StoredMenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import {
  deriveProfilePageViewModel,
  resolveMenteeAvatarSrc,
} from '@/lib/profile/profileProjection';
import {
  formatSelectedDate,
  toDateKey,
} from '@/lib/profile/scheduleFormatters';
import { cn } from '@/lib/utils';

import {
  ProfileContentSkeleton,
  ProfileHeaderSkeleton,
  ScheduleSkeleton,
} from './skeleton';

export type ProfileTabKey = 'about' | 'feedback';

interface ProfileIntroSectionsProps {
  userData: UserType;
  industryHashtag?: string | null;
  badgeSections: React.ReactNode;
  personalLinks: ReadonlyArray<ResolvedDisplaySocialLink>;
}

function ProfileIntroSections({
  userData,
  industryHashtag,
  badgeSections,
  personalLinks,
}: ProfileIntroSectionsProps) {
  const hasAboutSection = Boolean(userData.about || industryHashtag);

  return (
    <>
      {hasAboutSection && (
        <div>
          <p
            className={cn(
              industryHashtag ? 'mb-3' : 'mb-4',
              'text-xl font-bold'
            )}
          >
            關於我
          </p>
          {industryHashtag && (
            <p
              data-testid="mentor-industry-hashtag"
              className={cn(
                'text-brand-700 text-sm font-medium break-words',
                userData.about && 'mb-3'
              )}
            >
              {industryHashtag}
            </p>
          )}
          {userData.about && (
            <p className="text-text-tertiary text-sm break-words whitespace-pre-line">
              {userData.about}
            </p>
          )}
        </div>
      )}

      {userData.personal_statement && (
        <div className={hasAboutSection ? 'mt-10' : undefined}>
          <p className="mb-4 text-xl font-bold">給導生的話</p>
          <p className="text-text-tertiary text-sm break-words whitespace-pre-line">
            {userData.personal_statement}
          </p>
        </div>
      )}

      {badgeSections}

      {!!userData.workExperiences?.length && (
        <div className="border-background-border mt-8 border-t pt-8">
          <p className="mb-4 text-xl font-bold">工作經驗</p>
          <WorkExperienceSection
            workExperiences={userData.workExperiences}
            industries={userData.industries}
          />
        </div>
      )}

      {!!userData.educations?.length && (
        <div className="border-background-border mt-8 border-t pt-8">
          <p className="mb-4 text-xl font-bold">教育經歷</p>
          <EducationSection educations={userData.educations} />
        </div>
      )}

      <div className="border-background-border mt-8 border-t pt-8">
        <p className="mb-4 text-xl font-bold">個人連結</p>
        <PersonalLinksGrid
          links={personalLinks}
          isMentor={Boolean(userData.is_mentor)}
          location="profile_links_section"
        />
      </div>
    </>
  );
}

interface Props {
  userData: UserType | null;
  userLoading: boolean;
  schedule: BookingCalendarReader;
  scheduleLoaded: boolean;
  feedback?: Partial<MentorFeedbackState>;
  defaultTab?: ProfileTabKey;
  loginUserId: string;
  isIdentityResolved: boolean;
  canShowOwnerControls: boolean;
  avatarSrc: string | StaticImageData;
  onReservation: () => void;
  onEditProfile: () => void;
  editorDialog?: React.ReactNode;
  showBookmark?: boolean;
  feedbackEnabled?: boolean;
  storedDirectionMap?: StoredMenteeDirectionMap | null;
}

export default function ProfilePageUI({
  userData,
  userLoading,
  schedule,
  scheduleLoaded,
  feedback,
  defaultTab = 'about',
  loginUserId,
  isIdentityResolved,
  canShowOwnerControls,
  avatarSrc,
  onReservation,
  onEditProfile,
  editorDialog,
  showBookmark,
  feedbackEnabled: feedbackEnabledProp,
  storedDirectionMap,
}: Props) {
  const { selectedDate, setSelectedDate, getDayBookingStatus } = schedule;

  const locationLabel = userData?.location || undefined;

  const safePersonalLinks = useMemo(
    () => resolveDisplaySocialLinks(userData?.personalLinks),
    [userData?.personalLinks]
  );

  const viewModel = useMemo(
    () =>
      deriveProfilePageViewModel({
        userData,
        userLoading,
        isIdentityResolved,
        canShowOwnerControls,
        feedback,
        favoritesEnabled: showBookmark,
        feedbackEnabled: feedbackEnabledProp,
        safePersonalLinksCount: safePersonalLinks.length,
        resolvedLocation: locationLabel,
      }),
    [
      userData,
      userLoading,
      isIdentityResolved,
      canShowOwnerControls,
      feedback,
      showBookmark,
      feedbackEnabledProp,
      safePersonalLinks.length,
      locationLabel,
    ]
  );

  const {
    showScheduleRegion,
    isOwnMentorProfile,
    canShowMentorOwnerControls,
    canShowMenteeOwnerControls,
    canShowMentorBookmark,
    feedbackEnabled,
    effectiveRatingCount,
    effectiveRatingAverage,
    effectiveCompletedMeetings,
    mentorIndustryHashtag,
    menteeIndustryHashtag,
    menteeEmpty,
    menteeLatestRole,
    menteeExperienceDisplay,
  } = viewModel;

  // Only mentors viewing their own profile see booking status dots.
  const getDateStatus = useCallback(
    (date: Date) =>
      isOwnMentorProfile ? getDayBookingStatus(toDateKey(date)) : null,
    [isOwnMentorProfile, getDayBookingStatus]
  );

  const mentorSnapshot = useMemo(
    () =>
      userData?.is_mentor ? normalizeMentorFromProfile(userData) : undefined,
    [userData]
  );

  const effectiveAvatarSrc =
    userData && !userData.is_mentor
      ? resolveMenteeAvatarSrc(userData.avatar)
      : avatarSrc;

  const {
    menteeDirectionGroups,
    activeMenteeDirection,
    setActiveMenteeDirection,
  } = useMenteeProfileView({
    userData,
    storedDirectionMap,
  });

  return (
    <div>
      <ProfileBanner />

      <div className="container mb-20 max-w-screen-lg xl:max-w-screen-xl">
        {userLoading ? (
          <ProfileHeaderSkeleton />
        ) : userData ? (
          <>
            <div className="-mt-10 mb-6 flex h-auto flex-col sm:flex-row sm:items-start">
              <div className="border-background-white bg-background-white relative mx-auto h-[160px] w-[160px] flex-shrink-0 overflow-hidden rounded-full border-4 shadow-sm sm:mx-0">
                <Image
                  src={effectiveAvatarSrc}
                  alt={'Avatar of ' + userData.name}
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized={
                    typeof effectiveAvatarSrc === 'string' &&
                    effectiveAvatarSrc.startsWith('/avatars/')
                  }
                  priority
                />
              </div>

              <div className="mt-4 flex min-w-0 flex-1 flex-col items-center sm:mt-14 sm:ml-6 sm:items-start">
                <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col items-center sm:items-start">
                    <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                      <p className="text-2xl font-semibold break-words">
                        {userData.name}
                      </p>
                    </div>
                    {userData.is_mentor ? (
                      (userData.job_title || userData.company) && (
                        <p className="text-text-secondary mt-1.5 text-sm">
                          {userData.job_title}
                          {userData.job_title && userData.company && (
                            <span className="text-text-tertiary"> · </span>
                          )}
                          {userData.company}
                        </p>
                      )
                    ) : menteeLatestRole ? (
                      <p className="text-text-secondary mt-1.5 text-sm">
                        {menteeLatestRole.jobTitle}
                        {menteeLatestRole.jobTitle &&
                          menteeLatestRole.company && (
                            <span className="text-text-tertiary"> at </span>
                          )}
                        {menteeLatestRole.company}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {canShowMentorBookmark && (
                      <MentorBookmarkButton
                        mentorId={userData.user_id}
                        mentorName={userData.name}
                        mentorSnapshot={mentorSnapshot}
                        feature="profile"
                        variant="outline"
                        tooltipSide="top"
                        tooltipAlign="end"
                      />
                    )}
                    {canShowMenteeOwnerControls && (
                      <Button
                        variant="outline"
                        className="focus-visible:border-ring rounded-lg px-4 py-2.5 focus-visible:ring-offset-0"
                        onClick={onEditProfile}
                        data-analytics-click="profile_edit_click"
                        data-analytics-feature="profile"
                        data-analytics-location="profile_header"
                      >
                        <Pencil className="mr-1.5 size-4" aria-hidden="true" />
                        編輯個人資訊
                      </Button>
                    )}
                  </div>
                </div>
                {canShowMentorOwnerControls && (
                  <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
                    {/* canShowOwnerControls gates owner actions: until useSession() settles,
                        withhold buttons rather than flash a guest view before correcting. */}
                    <Button
                      variant="outline"
                      className="grow rounded-lg px-4 py-2.5 focus-visible:ring-offset-0 sm:grow-0"
                      onClick={onEditProfile}
                      data-analytics-click="profile_edit_click"
                      data-analytics-feature="profile"
                      data-analytics-location="profile_header"
                    >
                      <Pencil className="mr-1.5 size-4" aria-hidden="true" />
                      編輯個人資訊
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {userData.is_mentor ? (
              <MentorSummaryBar
                ratingAverage={effectiveRatingAverage}
                ratingCount={effectiveRatingCount}
                completedMeetingCount={effectiveCompletedMeetings}
                yearsOfExperience={userData.years_of_experience}
                location={locationLabel}
                includeRating={feedbackEnabled}
              />
            ) : !menteeEmpty ? (
              <MenteeSummaryBar
                yearsOfExperience={menteeExperienceDisplay}
                location={locationLabel}
                directionCount={menteeDirectionGroups.length}
              />
            ) : null}
          </>
        ) : null}

        <div className="flex flex-col gap-8 xl:flex-row xl:gap-12">
          <div className="w-full xl:w-3/5">
            {userLoading ? (
              <ProfileContentSkeleton />
            ) : userData ? (
              userData.is_mentor ? (
                (() => {
                  const mentorIntroSections = (
                    <ProfileIntroSections
                      userData={userData}
                      industryHashtag={mentorIndustryHashtag}
                      personalLinks={safePersonalLinks}
                      badgeSections={
                        Boolean(
                          userData.have_topic?.length ||
                          userData.have_skill?.length
                        ) ? (
                          <div className="border-background-border mt-8 space-y-6 border-t pt-8">
                            <p className="text-xl font-bold">服務與專長</p>
                            <ProfileBadgeSection
                              title="我能提供的服務"
                              items={userData.have_topic}
                              tone="brand"
                              subheading
                            />
                            <ProfileBadgeSection
                              title="專業能力"
                              items={userData.have_skill}
                              tone="subtle"
                              subheading
                            />
                          </div>
                        ) : null
                      }
                    />
                  );

                  if (!feedbackEnabled) {
                    return mentorIntroSections;
                  }

                  return (
                    <Tabs defaultValue={defaultTab}>
                      <TabsList
                        aria-label="導師頁面分頁"
                        className="border-background-border flex h-auto justify-start gap-8 rounded-none border-b bg-transparent p-0"
                      >
                        <TabsTrigger
                          value="about"
                          data-analytics-click="profile_tab_about"
                          data-analytics-event="profile_tab_click"
                          data-analytics-feature="profile"
                          data-analytics-location="profile_tabs"
                          data-analytics-param-tab-name="about"
                          data-analytics-param-mentor-id={String(
                            userData.user_id
                          )}
                          className="text-text-secondary hover:text-text-primary data-[state=active]:border-brand-700 data-[state=active]:text-brand-700 -mb-px rounded-none border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-base font-medium shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                          簡介
                        </TabsTrigger>
                        <TabsTrigger
                          value="feedback"
                          data-analytics-click="profile_tab_feedback"
                          data-analytics-event="profile_tab_click"
                          data-analytics-feature="profile"
                          data-analytics-location="profile_tabs"
                          data-analytics-param-tab-name="feedback"
                          data-analytics-param-mentor-id={String(
                            userData.user_id
                          )}
                          className="group text-text-secondary hover:text-text-primary data-[state=active]:border-brand-700 data-[state=active]:text-brand-700 -mb-px inline-flex items-baseline gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-1 pt-2 pb-3 text-base font-medium shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                          <span>評價</span>
                          <span className="text-text-tertiary group-data-[state=active]:text-brand-700 text-xs font-normal tabular-nums">
                            {effectiveRatingCount}
                          </span>
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="about" className="mt-6">
                        {mentorIntroSections}
                      </TabsContent>

                      <TabsContent value="feedback" className="mt-0">
                        <MentorFeedbackSection
                          items={feedback?.items ?? []}
                          totalRatingCount={effectiveRatingCount}
                          ratingAverage={effectiveRatingAverage}
                          page={feedback?.page}
                          pageSize={feedback?.pageSize}
                          isLoading={Boolean(feedback?.isLoading)}
                          error={feedback?.error ?? null}
                          onPageChange={feedback?.setPage}
                          onRetry={feedback?.reload}
                        />
                      </TabsContent>
                    </Tabs>
                  );
                })()
              ) : (
                <MenteeProfileContent
                  userData={userData}
                  isEmpty={menteeEmpty}
                  industryHashtag={menteeIndustryHashtag}
                  directionGroups={menteeDirectionGroups}
                  activeDirection={activeMenteeDirection}
                  onSelectDirection={setActiveMenteeDirection}
                  personalLinks={safePersonalLinks}
                />
              )
            ) : null}
          </div>

          {showScheduleRegion ? (
            <div className="w-full xl:w-2/5">
              {!scheduleLoaded ? (
                <ScheduleSkeleton />
              ) : (
                <div className="flex w-full max-w-[335px] flex-col gap-4 md:max-w-[695px] xl:max-w-[414px]">
                  <div className="border-background-border bg-background-white w-full rounded-2xl border p-5 shadow-sm">
                    <div className="border-background-border mb-3 border-b pb-3">
                      <p className="text-text-tertiary mb-1 text-xs font-medium">
                        可預約日期
                      </p>
                      <h2 className="text-text-primary text-2xl font-semibold tracking-tight md:text-3xl xl:text-2xl">
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
                      month={
                        schedule.year && schedule.month
                          ? new Date(schedule.year, schedule.month - 1, 1)
                          : undefined
                      }
                      onSelect={(d) => setSelectedDate(d ? toDateKey(d) : null)}
                      onMonthChange={(d) => schedule.onMonthChange?.(d)}
                      allowedDates={schedule.allowedDates}
                      showTodayStyle={false}
                      disableEmptyDates={true}
                      isMonthLoading={!schedule.slotsSnapshot.monthLoaded}
                      getDateStatus={getDateStatus}
                      hasError={schedule.hasError}
                      onRetry={schedule.reload}
                    />
                  </div>
                  {!schedule.hasError && (
                    <BookingForm
                      isOwnMentorProfile={isOwnMentorProfile}
                      isUserDataLoading={userLoading || !isIdentityResolved}
                      isAuthenticated={!!loginUserId}
                      isIdentityResolved={isIdentityResolved}
                      mentorId={userData?.user_id}
                      reader={schedule}
                      onReservation={onReservation}
                      myUserId={loginUserId}
                    />
                  )}
                  {editorDialog}
                </div>
              )}
            </div>
          ) : !userLoading && userData && !userData.is_mentor ? (
            <div className="w-full xl:w-2/5">
              <MenteeWatchedPositionsCard
                groups={menteeDirectionGroups}
                activeDirection={activeMenteeDirection}
                onSelectDirection={setActiveMenteeDirection}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import Image, { type StaticImageData } from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { resolveDisplaySocialLinks } from '@/components/profile/social-links/platformLabelMap';
import { ProfileBadgeSection } from '@/components/profile/view/ProfileBadgeSection';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MentorFeedbackState } from '@/hooks/user/feedback/useMentorFeedback';
import { UserType } from '@/hooks/user/user-data/useUserData';
import { isFavoritesEnabled, isFeedbackEnabled } from '@/lib/featureFlags';
import { normalizeMentorFromProfile } from '@/lib/mentor/mentorCardModel';
import { resolveLocationLabel } from '@/lib/mentor/mentorStats';
import {
  BookingCalendarReader,
  BookingSlot,
} from '@/lib/profile/bookingAvailability';
import {
  buildMenteeDirectionReadGroups,
  isMenteeProfileEmpty,
  readStoredMenteeDirectionViewMap,
  resolveMenteeAvatarSrc,
  resolveMenteeExperienceSummary,
  resolveMenteeIndustryHashtag,
  resolveMenteeLatestRole,
  type StoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionView';
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
}

function ProfileIntroSections({
  userData,
  industryHashtag,
  badgeSections,
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
        <div className="mt-10">
          <p className="mb-4 text-xl font-bold">工作經驗</p>
          <WorkExperienceSection workExperiences={userData.workExperiences} />
        </div>
      )}

      {!!userData.educations?.length && (
        <div className="mt-10">
          <p className="mb-4 text-xl font-bold">教育</p>
          <EducationSection educations={userData.educations} />
        </div>
      )}
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
  allowedDates?: string[];
  onScheduleMonthChange?: (date: Date) => void;
  onReservation: () => void;
  onEditProfile: () => void;
  onBecomeMentor: () => void;
  selectedSlot?: BookingSlot | null;
  setSelectedSlot?: (slot: BookingSlot | null) => void;
  isSubmitting: boolean;
  onConfirmReservation: (question?: string) => Promise<boolean>;
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
  allowedDates,
  onScheduleMonthChange,
  onReservation,
  onEditProfile,
  onBecomeMentor: _onBecomeMentor,
  selectedSlot,
  setSelectedSlot,
  isSubmitting,
  onConfirmReservation,
  editorDialog,
  showBookmark,
  feedbackEnabled: feedbackEnabledProp,
  storedDirectionMap,
}: Props) {
  const { selectedDate, setSelectedDate, getDayBookingStatus } = schedule;
  const resolvedAllowedDates = allowedDates ?? schedule.allowedDates;
  const resolvedSelectedSlot = selectedSlot ?? schedule.selectedSlot ?? null;
  const resolvedSetSelectedSlot =
    setSelectedSlot ?? schedule.setSelectedSlot ?? (() => {});
  const resolvedOnMonthChange =
    onScheduleMonthChange ?? ((d: Date) => schedule.onMonthChange?.(d));

  // Render the schedule region while user data loads (most profile views are
  // mentors) so the calendar can appear before user data resolves; collapse
  // it once the user is confirmed as a non-mentor.
  const showScheduleRegion = userLoading || userData?.is_mentor;
  // Derived from canShowOwnerControls (the single ownership source of
  // truth) rather than re-comparing loginUserId against userData.user_id -
  // keeps this in lockstep with the owner-only UI gating above instead of
  // being a second, independently-computed ownership check that could
  // silently diverge from it.
  const favoritesEnabled = showBookmark ?? isFavoritesEnabled();
  const feedbackEnabled = feedbackEnabledProp ?? isFeedbackEnabled();

  const isOwnMentorProfile =
    !!userData && userData.is_mentor && canShowOwnerControls;
  const isOwnProfileByLoginId =
    Boolean(loginUserId) &&
    userData !== null &&
    String(loginUserId) === String(userData.user_id);
  const canShowMentorBookmark = Boolean(
    favoritesEnabled &&
    isIdentityResolved &&
    userData?.is_mentor &&
    !canShowOwnerControls &&
    !isOwnProfileByLoginId
  );

  // Only mentors viewing their own profile see booking status dots.
  const getDateStatus = useCallback(
    (date: Date) =>
      isOwnMentorProfile ? getDayBookingStatus(toDateKey(date)) : null,
    [isOwnMentorProfile, getDayBookingStatus]
  );

  const hasFreshFeedback = Boolean(
    feedbackEnabled && feedback?.hasLoaded && !feedback.isFallbackEmpty
  );

  const effectiveRatingCount = feedbackEnabled
    ? hasFreshFeedback
      ? (feedback?.totalRatingCount ?? userData?.stats?.rating_count ?? 0)
      : (userData?.stats?.rating_count ?? feedback?.totalRatingCount ?? 0)
    : 0;

  const effectiveRatingAverage =
    feedbackEnabled && effectiveRatingCount > 0
      ? hasFreshFeedback
        ? (feedback?.ratingAverage ?? userData?.stats?.rating_average ?? null)
        : (userData?.stats?.rating_average ?? feedback?.ratingAverage ?? null)
      : null;

  const effectiveCompletedMeetings = hasFreshFeedback
    ? (feedback?.completedMeetingCount ??
      userData?.stats?.completed_meeting_count ??
      0)
    : (userData?.stats?.completed_meeting_count ??
      feedback?.completedMeetingCount ??
      0);

  const resolvedLocation = useMemo(() => {
    if (!userData) return undefined;
    if (userData.location) return userData.location;
    const fallbackJobLocation =
      userData.workExperiences?.find((exp) => exp.is_primary)?.job_location ||
      userData.workExperiences?.[0]?.job_location;
    return resolveLocationLabel(fallbackJobLocation, 'zh_TW');
  }, [userData]);

  const mentorIndustryHashtag = useMemo<string | null>(() => {
    if (!userData?.is_mentor) return null;
    const rawIndustry =
      userData.industry?.trim() ||
      userData.industries?.[0]?.subject?.trim() ||
      '';
    const normalized = rawIndustry.replace(/^#+/, '').trim();
    return normalized ? `#${normalized}` : null;
  }, [userData]);

  const mentorSnapshot = useMemo(
    () =>
      userData?.is_mentor ? normalizeMentorFromProfile(userData) : undefined,
    [userData]
  );

  const safePersonalLinks = useMemo(
    () => resolveDisplaySocialLinks(userData?.personalLinks),
    [userData?.personalLinks]
  );

  const menteeIndustryHashtag = useMemo<string | null>(() => {
    if (!userData || userData.is_mentor) return null;
    return resolveMenteeIndustryHashtag(userData);
  }, [userData]);

  const [storedMenteeMap, setStoredMenteeMap] =
    useState<ReturnType<typeof readStoredMenteeDirectionViewMap>>(null);

  useEffect(() => {
    if (storedDirectionMap !== undefined) {
      setStoredMenteeMap(storedDirectionMap);
      return;
    }
    if (!userData || userData.is_mentor) {
      setStoredMenteeMap(null);
      return;
    }
    setStoredMenteeMap(readStoredMenteeDirectionViewMap(userData.user_id));
  }, [userData, storedDirectionMap]);

  const menteeDirectionGroups = useMemo(() => {
    if (!userData || userData.is_mentor) return [];
    return buildMenteeDirectionReadGroups({
      positions: userData.want_position,
      skills: userData.want_skill,
      topics: userData.want_topic,
      storedMap: storedMenteeMap,
    });
  }, [userData, storedMenteeMap]);

  const [activeMenteeDirection, setActiveMenteeDirection] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (menteeDirectionGroups.length === 0) {
      setActiveMenteeDirection(null);
      return;
    }
    setActiveMenteeDirection((prev) =>
      prev && menteeDirectionGroups.some((g) => g.key === prev)
        ? prev
        : menteeDirectionGroups[0].key
    );
  }, [menteeDirectionGroups]);

  const menteeEmpty = useMemo(() => {
    if (!userData || userData.is_mentor) return false;
    return isMenteeProfileEmpty(
      userData,
      safePersonalLinks.length,
      resolvedLocation
    );
  }, [userData, safePersonalLinks.length, resolvedLocation]);

  const effectiveAvatarSrc = useMemo(() => {
    if (!userData || userData.is_mentor) return avatarSrc;
    return resolveMenteeAvatarSrc(userData.avatar);
  }, [avatarSrc, userData]);

  const menteeLatestRole = useMemo(() => {
    if (!userData || userData.is_mentor) return null;
    return resolveMenteeLatestRole(userData);
  }, [userData]);

  const menteeExperienceDisplay = useMemo(() => {
    if (!userData || userData.is_mentor) return undefined;
    return resolveMenteeExperienceSummary(userData);
  }, [userData]);

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
                  priority
                />
              </div>

              <div className="mt-4 flex min-w-0 flex-1 flex-col items-center sm:mt-14 sm:ml-6 sm:items-start">
                <div className="mb-2 flex w-full flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <p className="text-2xl font-semibold break-words">
                      {userData.name}
                    </p>
                    {userData.is_mentor && safePersonalLinks.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        {safePersonalLinks.map((link, index) => (
                          <a
                            key={`${link.platform}-${index}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={link.label}
                            title={link.label}
                            data-analytics-click="profile_social_link"
                            data-analytics-event="profile_social_link_click"
                            data-analytics-feature="profile"
                            data-analytics-location="profile_header"
                            data-analytics-omit-destination="true"
                            data-analytics-param-platform={link.platform}
                            data-analytics-param-mentor-id={String(
                              userData.user_id
                            )}
                            className="text-text-secondary hover:text-brand-500"
                          >
                            {link.icon}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
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
                </div>
                {userData.is_mentor ? (
                  (userData.job_title || userData.company) && (
                    <p className="text-text-secondary text-sm">
                      {userData.job_title}
                      {userData.job_title && userData.company && (
                        <span className="text-text-tertiary"> · </span>
                      )}
                      {userData.company}
                    </p>
                  )
                ) : menteeLatestRole ? (
                  <p className="text-text-secondary text-sm">
                    {menteeLatestRole.jobTitle}
                    {menteeLatestRole.jobTitle && menteeLatestRole.company && (
                      <span className="text-text-tertiary"> at </span>
                    )}
                    {menteeLatestRole.company}
                  </p>
                ) : null}
                {canShowOwnerControls && (
                  <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
                    {/* canShowOwnerControls gates owner actions: until useSession() settles,
                        withhold buttons rather than flash a guest view before correcting. */}
                    <Button
                      variant="outline"
                      className="grow rounded-full px-6 py-3 sm:grow-0"
                      onClick={onEditProfile}
                      data-analytics-click="profile_edit_click"
                      data-analytics-feature="profile"
                      data-analytics-location="profile_header"
                    >
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
                location={resolvedLocation}
                includeRating={feedbackEnabled}
              />
            ) : !menteeEmpty ? (
              <MenteeSummaryBar
                yearsOfExperience={menteeExperienceDisplay}
                location={resolvedLocation}
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
                      badgeSections={
                        <>
                          <ProfileBadgeSection
                            title="專業能力"
                            items={userData.have_skill}
                          />
                          <ProfileBadgeSection
                            title="我能提供的服務"
                            items={userData.have_topic}
                          />
                        </>
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
                      onMonthChange={resolvedOnMonthChange}
                      allowedDates={resolvedAllowedDates}
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
                      slotsSnapshot={schedule.slotsSnapshot}
                      selectedSlot={resolvedSelectedSlot}
                      setSelectedSlot={resolvedSetSelectedSlot}
                      isSubmitting={isSubmitting}
                      selectedDate={selectedDate}
                      onReservation={onReservation}
                      onConfirmReservation={onConfirmReservation}
                      myUserId={loginUserId}
                    />
                  )}
                  {editorDialog}
                </div>
              )}
            </div>
          ) : userData ? (
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

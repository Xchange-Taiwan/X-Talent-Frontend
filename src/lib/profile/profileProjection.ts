import { TotalWorkSpanEnum } from '@/constant/seniority';
import { resolveAvatarDisplayUrl } from '@/lib/avatar/avatarUrl';
import { isFavoritesEnabled, isFeedbackEnabled } from '@/lib/featureFlags';
import { normalizeMentorStats } from '@/lib/mentor/mentorStats';
import {
  decode,
  type EducationExperienceMetadata,
  fromWireExperiences,
  type WorkExperienceMetadata,
} from '@/lib/profile/experienceCodec';
import { resolveLocationLabel } from '@/lib/profile/locations';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import {
  type NormalizedPersonalLink,
  normalizePersonalLinks,
} from '@/lib/profile/socialLinks';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import type { MentorStats } from '@/types/mentor';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO, TagDisplay, UserType } from '@/types/user';

export { type NormalizedPersonalLink, normalizePersonalLinks };

const EMPTY_LABEL_MAP: ReadonlyMap<string, string> = new Map();

export interface ProjectUserProfileOptions {
  catalogs?: TagCatalogsByBucket | null;
  labelMap?: ReadonlyMap<string, string>;
  language?: string;
}

export interface ProjectedUserProfile extends UserType {
  years_of_experience_code?: string;
  location_code: string | null;
  industry_code: string | null;
  industries: TagDisplay[];
  updated_at: string | null;
  stats: MentorStats | null;
  workExperiences: WorkExperienceMetadata[];
  educations: EducationExperienceMetadata[];
  personalLinks: NormalizedPersonalLink[];
}

export interface ProfileFeedbackSummaryInput {
  hasLoaded?: boolean;
  isFallbackEmpty?: boolean;
  totalRatingCount?: number | null;
  ratingAverage?: number | null;
  completedMeetingCount?: number | null;
}

export interface DeriveProfilePageViewModelInput {
  userData: UserType | null;
  userLoading: boolean;
  isIdentityResolved: boolean;
  canShowOwnerControls: boolean;
  feedback?: ProfileFeedbackSummaryInput;
  favoritesEnabled?: boolean;
  feedbackEnabled?: boolean;
  enableBecomeMentorCta?: boolean;
  safePersonalLinksCount?: number;
  resolvedLocation?: string;
}

export interface ProfilePageViewModel {
  showScheduleRegion: boolean;
  isOwnMentorProfile: boolean;
  canShowOwnerControls: boolean;
  canShowEditProfileButton: boolean;
  canShowMentorOwnerControls: boolean;
  canShowMenteeOwnerControls: boolean;
  canShowBecomeMentorCta: boolean;
  canShowMentorBookmark: boolean;
  favoritesEnabled: boolean;
  feedbackEnabled: boolean;
  hasFreshFeedback: boolean;
  effectiveRatingCount: number;
  effectiveRatingAverage: number | null;
  effectiveCompletedMeetings: number;
  mentorIndustryHashtag: string | null;
  menteeIndustryHashtag: string | null;
  menteeEmpty: boolean;
  menteeLatestRole: { jobTitle: string; company: string } | null;
  menteeExperienceDisplay: string | undefined;
}

function toTagDisplay(
  codes: ReadonlyArray<string> | null | undefined,
  labelMap: ReadonlyMap<string, string>
): TagDisplay[] {
  if (!codes) return [];
  return codes
    .filter((c): c is string => Boolean(c))
    .map((subject_group) => ({
      subject_group,
      subject: labelMap.get(subject_group) ?? subject_group,
    }));
}

function collectIndustries(
  primaryIndustrySubject: string | undefined,
  primaryIndustryCode: string | null | undefined,
  workExperiences: ReadonlyArray<WorkExperienceMetadata>,
  labelMap: ReadonlyMap<string, string>
): TagDisplay[] {
  const seenSubjects = new Set<string>();
  const result: TagDisplay[] = [];

  if (primaryIndustrySubject) {
    seenSubjects.add(primaryIndustrySubject);
    result.push({
      subject_group: primaryIndustryCode || primaryIndustrySubject,
      subject: primaryIndustrySubject,
    });
  }

  for (const exp of workExperiences) {
    const rawCode = exp.industry?.trim();
    if (!rawCode) continue;
    const resolved = labelMap.get(rawCode) ?? rawCode;
    if (seenSubjects.has(resolved)) continue;
    seenSubjects.add(resolved);
    result.push({
      subject_group: rawCode,
      subject: resolved,
    });
  }

  return result;
}

function resolveCurrentRole(
  userDto: MentorProfileVO,
  workExperiences: ReadonlyArray<WorkExperienceMetadata>
): { jobTitle: string; company: string } {
  if (workExperiences.length === 0) {
    return {
      jobTitle: userDto.job_title ?? '',
      company: userDto.company ?? '',
    };
  }

  const primary =
    workExperiences.find((entry) => entry.is_primary) ?? workExperiences[0];

  return {
    jobTitle: primary.job ?? userDto.job_title ?? '',
    company: primary.company ?? userDto.company ?? '',
  };
}

/**
 * Pure, zero-React projection from `MentorProfileVO` into `ProjectedUserProfile`
 * (`UserType`), preserving both raw wire codes (`years_of_experience_code`,
 * `location_code`, `industry_code`, `TagDisplay.subject_group`) and localized
 * display labels while unifying primary-role fallback and personal-link
 * normalization across client views and SSR JSON-LD.
 */
export function projectUserProfile(
  userDto: MentorProfileVO,
  options?: ProjectUserProfileOptions
): ProjectedUserProfile {
  const language = options?.language ?? 'zh_TW';
  const labelMap: ReadonlyMap<string, string> =
    options?.labelMap ??
    (options?.catalogs ? buildTagLabelMap(options.catalogs) : EMPTY_LABEL_MAP);

  const safeExperiences = fromWireExperiences(userDto.experiences)?.filter(
    (entry) => Boolean(entry && typeof entry === 'object')
  );
  const { workExperiences, educations, personalLinks } =
    decode(safeExperiences);

  const { jobTitle, company } = resolveCurrentRole(userDto, workExperiences);

  const industryTag = readIndustryTag(userDto.industry);
  const rawIndustryGroup = industryTag?.subject_group?.trim() || undefined;
  const rawIndustrySubject = industryTag?.subject?.trim() || undefined;
  const industryCode = rawIndustryGroup || rawIndustrySubject || null;
  const industrySubject =
    industryTag?.subject ||
    (industryTag?.subject_group
      ? (labelMap.get(industryTag.subject_group) ?? industryTag.subject_group)
      : undefined);

  const rawTopLocation = userDto.location?.trim() || null;
  const primaryWorkLocation =
    workExperiences.find((exp) => exp.is_primary)?.job_location ||
    workExperiences[0]?.job_location;
  const locationCode = rawTopLocation || primaryWorkLocation?.trim() || null;
  const location = resolveLocationLabel(locationCode, language);

  const industries = collectIndustries(
    industrySubject,
    industryTag?.subject_group,
    workExperiences,
    labelMap
  );

  const rawYears = userDto.years_of_experience?.trim() || undefined;
  const yearsOfExperience = userDto.years_of_experience
    ? (TotalWorkSpanEnum[
        userDto.years_of_experience as keyof typeof TotalWorkSpanEnum
      ] ?? userDto.years_of_experience)
    : undefined;

  const rawUpdatedAt = userDto.updated_at;
  const updatedAt =
    rawUpdatedAt === null || rawUpdatedAt === undefined || rawUpdatedAt === ''
      ? null
      : String(rawUpdatedAt);

  return {
    user_id: userDto.user_id,
    name: userDto.name ?? '',
    avatar: userDto.avatar ?? '',
    job_title: jobTitle,
    company,
    is_mentor: userDto.is_mentor ?? false,
    about: userDto.about ?? '',
    personal_statement: userDto.personal_statement ?? '',
    years_of_experience: yearsOfExperience,
    years_of_experience_code: rawYears,
    seniority_level: userDto.seniority_level ?? '',
    location,
    location_code: locationCode,
    industry: industrySubject,
    industry_code: industryCode,
    industries,
    updated_at: updatedAt,
    stats: normalizeMentorStats(userDto),
    want_position: toTagDisplay(userDto.want_position, labelMap),
    want_skill: toTagDisplay(userDto.want_skill, labelMap),
    want_topic: toTagDisplay(userDto.want_topic, labelMap),
    have_skill: toTagDisplay(userDto.have_skill, labelMap),
    have_topic: toTagDisplay(userDto.have_topic, labelMap),
    workExperiences,
    educations,
    personalLinks: normalizePersonalLinks(personalLinks),
  };
}

export const DEFAULT_MENTEE_AVATAR_URL = '/avatars/default_1.webp';

export function resolveMenteeAvatarSrc(
  avatar: string | null | undefined
): string {
  return resolveAvatarDisplayUrl(avatar, true);
}

function parsePeriodEndRank(
  end: string | undefined,
  currentYear: number
): number {
  if (!end) return 0;
  const trimmed = end.trim().toLowerCase();
  if (trimmed === 'now' || trimmed === '至今') return currentYear + 1;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveMenteeLatestRole(
  userData: Pick<UserType, 'workExperiences'> | null | undefined,
  currentYear = new Date().getFullYear()
): { jobTitle: string; company: string } | null {
  const list = userData?.workExperiences;
  if (!list?.length) return null;

  const validList = list.filter((item) =>
    Boolean(item.job?.trim() || item.company?.trim())
  );
  if (!validList.length) return null;

  let best = validList[0];
  let bestEnd = parsePeriodEndRank(best.job_period_end, currentYear);
  let bestStart = Number(best.job_period_start) || 0;

  for (let i = 1; i < validList.length; i += 1) {
    const candidate = validList[i];
    const endRank = parsePeriodEndRank(candidate.job_period_end, currentYear);
    const startRank = Number(candidate.job_period_start) || 0;
    if (endRank > bestEnd || (endRank === bestEnd && startRank > bestStart)) {
      best = candidate;
      bestEnd = endRank;
      bestStart = startRank;
    }
  }

  const jobTitle = best.job?.trim() ?? '';
  const company = best.company?.trim() ?? '';
  return { jobTitle, company };
}

export function resolveMenteeExperienceSummary(
  userData:
    | Pick<UserType, 'workExperiences' | 'years_of_experience'>
    | null
    | undefined,
  currentYear = new Date().getFullYear()
): string | undefined {
  const list = userData?.workExperiences;
  if (!list?.length) {
    return userData?.years_of_experience;
  }

  let totalYears = 0;
  let countedAny = false;
  for (const exp of list) {
    const startYear = Number(exp.job_period_start);
    if (!Number.isFinite(startYear) || startYear <= 0) continue;
    const rawEnd = exp.job_period_end?.trim().toLowerCase();
    const endYear =
      !rawEnd || rawEnd === 'now' || rawEnd === '至今'
        ? currentYear
        : Number(rawEnd);
    if (!Number.isFinite(endYear) || endYear < startYear) continue;
    countedAny = true;
    totalYears += Math.max(1, endYear - startYear);
  }

  if (!countedAny) {
    return userData?.years_of_experience;
  }
  return `${totalYears} 年`;
}

export function resolveProfileIndustryHashtag(
  userData: Pick<UserType, 'industry' | 'industries'> | null | undefined
): string | null {
  if (!userData) return null;
  const rawIndustry =
    userData.industry?.trim() ||
    userData.industries?.[0]?.subject?.trim() ||
    '';
  const normalized = rawIndustry.replace(/^#+/, '').trim();
  return normalized ? `#${normalized}` : null;
}

export function isMenteeProfileEmpty(
  userData: UserType | null | undefined,
  safePersonalLinksCount: number,
  resolvedLocation?: string
): boolean {
  if (!userData) return true;
  const hasAbout = Boolean(userData.about?.trim());
  const hasIndustry = Boolean(resolveProfileIndustryHashtag(userData));
  const hasExperienceYears = Boolean(userData.years_of_experience?.trim());
  const hasLocation = Boolean(resolvedLocation?.trim());
  const hasPreferences = Boolean(
    userData.want_position?.length ||
    userData.want_skill?.length ||
    userData.want_topic?.length
  );
  const hasWork = Boolean(userData.workExperiences?.length);
  const hasEducation = Boolean(userData.educations?.length);
  const hasLinks = safePersonalLinksCount > 0;

  return !(
    hasAbout ||
    hasIndustry ||
    hasExperienceYears ||
    hasLocation ||
    hasPreferences ||
    hasWork ||
    hasEducation ||
    hasLinks
  );
}

/**
 * Pure view-model derivation for `ProfilePageUI`, coalescing:
 * - Single-source owner controls gating (`canShowOwnerControls` without
 *   re-comparing `loginUserId === userData.user_id`)
 * - Become Mentor CTA visibility (`enableBecomeMentorCta` opt-in, default false
 *   on `/profile/[pageUserId]` per #960)
 * - Favorite bookmark button visibility
 * - Feedback vs SSR stats priority derivation (including 404 fallback-empty preservation)
 * - Unified Mentor & Mentee profile display derivations (#industry hashtag, empty check,
 *   latest work role, and summed experience summary)
 */
export function deriveProfilePageViewModel({
  userData,
  userLoading,
  isIdentityResolved,
  canShowOwnerControls,
  feedback,
  favoritesEnabled: favoritesEnabledInput,
  feedbackEnabled: feedbackEnabledInput,
  enableBecomeMentorCta = false,
  safePersonalLinksCount = 0,
  resolvedLocation,
}: DeriveProfilePageViewModelInput): ProfilePageViewModel {
  const favoritesEnabled = favoritesEnabledInput ?? isFavoritesEnabled();
  const feedbackEnabled = feedbackEnabledInput ?? isFeedbackEnabled();

  const showScheduleRegion = Boolean(userLoading || userData?.is_mentor);
  const effectiveOwnerControls = Boolean(userData && canShowOwnerControls);
  const isOwnMentorProfile = Boolean(
    effectiveOwnerControls && userData?.is_mentor
  );
  const canShowMentorOwnerControls = isOwnMentorProfile;
  const canShowMenteeOwnerControls = Boolean(
    effectiveOwnerControls && !userData?.is_mentor
  );
  const canShowBecomeMentorCta = Boolean(
    canShowMenteeOwnerControls && enableBecomeMentorCta
  );

  const canShowMentorBookmark = Boolean(
    favoritesEnabled &&
    isIdentityResolved &&
    userData?.is_mentor &&
    !canShowOwnerControls
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

  const isMentee = Boolean(userData && !userData.is_mentor);
  const industryHashtag = resolveProfileIndustryHashtag(userData);
  const effectiveLocation =
    resolvedLocation ?? (userData?.location || undefined);

  return {
    showScheduleRegion,
    isOwnMentorProfile,
    canShowOwnerControls: effectiveOwnerControls,
    canShowEditProfileButton: effectiveOwnerControls,
    canShowMentorOwnerControls,
    canShowMenteeOwnerControls,
    canShowBecomeMentorCta,
    canShowMentorBookmark,
    favoritesEnabled,
    feedbackEnabled,
    hasFreshFeedback,
    effectiveRatingCount,
    effectiveRatingAverage,
    effectiveCompletedMeetings,
    mentorIndustryHashtag: userData?.is_mentor ? industryHashtag : null,
    menteeIndustryHashtag: isMentee ? industryHashtag : null,
    menteeEmpty: isMentee
      ? isMenteeProfileEmpty(
          userData,
          safePersonalLinksCount,
          effectiveLocation
        )
      : false,
    menteeLatestRole: isMentee ? resolveMenteeLatestRole(userData) : null,
    menteeExperienceDisplay: isMentee
      ? resolveMenteeExperienceSummary(userData)
      : undefined,
  };
}

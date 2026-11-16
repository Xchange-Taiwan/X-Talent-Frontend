import type { StaticImageData } from 'next/image';

import avatarImage from '@/assets/default-avatar.png';
import { TotalWorkSpanEnum } from '@/constant/seniority';
import { withAvatarVersion } from '@/lib/avatar/avatarUrl';
import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  formatRatingScoreValue,
  normalizeMentorStats,
  toNonNegativeInt,
} from '@/lib/mentor/mentorStats';
import type { MentorType } from '@/types/mentor';
import type { TagDisplay, UserType } from '@/types/user';

export interface MentorCardProjectionOptions {
  labelMap?: ReadonlyMap<string, string>;
  prioritizedCodes?: ReadonlySet<string>;
}

export interface MentorCardViewModel {
  id: number;
  name: string;
  avatar: string | StaticImageData;
  yearsOfExperienceLabel: string;
  jobTitle: string;
  company: string;
  about: string;
  tags: string[];
  ratingLabel: string | null;
  completedMeetingsLabel: string | null;
  mentorSnapshot: MentorType;
}

const WORK_SPAN_CODE_BY_LABEL = new Map<string, string>(
  Object.entries(TotalWorkSpanEnum).map(([code, label]) => [label, code])
);

const DEFAULT_AVATAR_SRC =
  typeof avatarImage === 'string' ? avatarImage : avatarImage.src;

function isDefaultAvatar(
  avatar: string | StaticImageData | null | undefined
): boolean {
  if (!avatar) {
    return false;
  }
  return (
    avatar === avatarImage ||
    (typeof avatar === 'string' && avatar === DEFAULT_AVATAR_SRC)
  );
}

function normalizeYearsOfExperienceCode(
  value: string | null | undefined
): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  return WORK_SPAN_CODE_BY_LABEL.get(trimmed) ?? trimmed;
}

function readTagCodes(
  tags: ReadonlyArray<TagDisplay> | null | undefined
): string[] {
  if (!tags) {
    return [];
  }
  return tags
    .map((tag) => tag.subject_group || tag.subject)
    .filter((code): code is string => Boolean(code));
}

function resolvePrimaryIndustryCode(userData: UserType): string | null {
  const rawIndustry = userData.industry?.trim() ?? '';
  if (!rawIndustry) {
    return null;
  }
  const primaryEntry = userData.industries?.[0];
  if (primaryEntry && primaryEntry.subject === rawIndustry) {
    return primaryEntry.subject_group || rawIndustry;
  }
  return rawIndustry;
}

// Cache-busts the avatar URL by updated_at so a re-uploaded photo isn't
// served stale and guarantees a non-empty fallback avatar across SSR, client
// wire mapping, profile snapshots, and card projection.
export function resolveMentorAvatar(mentor: MentorType): MentorType {
  const rawAvatar = mentor.avatar;
  let resolvedAvatar: string | StaticImageData;

  if (isDefaultAvatar(rawAvatar)) {
    resolvedAvatar = rawAvatar;
  } else if (typeof rawAvatar === 'string') {
    const trimmed = rawAvatar.trim();
    resolvedAvatar = trimmed
      ? withAvatarVersion(trimmed, mentor.updated_at, 'cb')
      : avatarImage;
  } else {
    resolvedAvatar = rawAvatar ?? avatarImage;
  }

  if (resolvedAvatar === mentor.avatar) {
    return mentor;
  }

  return {
    ...mentor,
    avatar: resolvedAvatar,
  };
}

export function normalizeMentorFromProfile(userData: UserType): MentorType {
  const rawUpdatedAt = userData.updated_at;
  const updatedAt =
    rawUpdatedAt === null || rawUpdatedAt === undefined || rawUpdatedAt === ''
      ? null
      : String(rawUpdatedAt);

  const normalized: MentorType = {
    user_id: userData.user_id,
    name: userData.name ?? '',
    avatar: userData.avatar ?? '',
    job_title: userData.job_title ?? '',
    company: userData.company ?? '',
    years_of_experience: normalizeYearsOfExperienceCode(
      userData.years_of_experience
    ),
    location: userData.location ?? '',
    personal_statement: userData.personal_statement ?? '',
    about: userData.about ?? '',
    seniority_level: userData.seniority_level ?? '',
    industry: resolvePrimaryIndustryCode(userData),
    want_position: readTagCodes(userData.want_position),
    want_skill: readTagCodes(userData.want_skill),
    want_topic: readTagCodes(userData.want_topic),
    have_skill: readTagCodes(userData.have_skill),
    have_topic: readTagCodes(userData.have_topic),
    updated_at: updatedAt,
    stats: userData.stats
      ? normalizeMentorStats({ stats: userData.stats })
      : null,
  };

  return resolveMentorAvatar(normalized);
}

export function buildMentorCardTags(
  mentor: Pick<MentorType, 'have_topic' | 'have_skill'>,
  prioritizedCodes?: ReadonlySet<string>,
  labelMap?: ReadonlyMap<string, string>
): string[] {
  const combinedCodes = Array.from(
    new Set([...(mentor.have_topic ?? []), ...(mentor.have_skill ?? [])])
  ).filter(Boolean);

  let orderedCodes = combinedCodes;
  if (prioritizedCodes && prioritizedCodes.size > 0) {
    const matched: string[] = [];
    const rest: string[] = [];
    for (const code of combinedCodes) {
      if (prioritizedCodes.has(code)) {
        matched.push(code);
      } else {
        rest.push(code);
      }
    }
    orderedCodes = [...matched, ...rest];
  }

  if (!labelMap || labelMap.size === 0) {
    return orderedCodes;
  }

  const resolvedLabels: string[] = [];
  const seenLabels = new Set<string>();
  for (const code of orderedCodes) {
    const label = labelMap.get(code) ?? code;
    if (label && !seenLabels.has(label)) {
      seenLabels.add(label);
      resolvedLabels.push(label);
    }
  }
  return resolvedLabels;
}

export function formatMentorRating(
  ratingAverage?: number | null,
  ratingCount?: number | null
): string | null {
  if (
    ratingCount !== undefined &&
    ratingCount !== null &&
    toNonNegativeInt(ratingCount) === 0
  ) {
    return null;
  }
  const score = formatRatingScoreValue(ratingAverage);
  return score ? `${score} / 10` : null;
}

export function formatCompletedMeetings(
  completedMeetingCount?: number | null
): string | null {
  const count = toNonNegativeInt(completedMeetingCount);
  return count > 0 ? `已完成 ${count} 場 1-on-1` : null;
}

export function projectMentorCard(
  mentor: MentorType,
  options?: MentorCardProjectionOptions
): MentorCardViewModel {
  const normalizedMentor = resolveMentorAvatar(mentor);
  const years = normalizedMentor.years_of_experience ?? '';
  const yearsOfExperienceLabel =
    TotalWorkSpanEnum[years as keyof typeof TotalWorkSpanEnum] ?? years;

  return {
    id: normalizedMentor.user_id,
    name: normalizedMentor.name,
    avatar: normalizedMentor.avatar,
    yearsOfExperienceLabel,
    jobTitle: normalizedMentor.job_title,
    company: normalizedMentor.company,
    about: normalizedMentor.about,
    tags: buildMentorCardTags(
      normalizedMentor,
      options?.prioritizedCodes,
      options?.labelMap
    ),
    ratingLabel: isFeedbackEnabled()
      ? formatMentorRating(
          normalizedMentor.stats?.rating_average,
          normalizedMentor.stats?.rating_count
        )
      : null,
    completedMeetingsLabel: formatCompletedMeetings(
      normalizedMentor.stats?.completed_meeting_count
    ),
    mentorSnapshot: normalizedMentor,
  };
}

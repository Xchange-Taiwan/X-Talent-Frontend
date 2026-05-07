import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import { isSafeUrl } from '@/lib/url/isSafeUrl';
import { ExperienceType } from '@/services/profile/experienceType';
import {
  buildTagLabelMap,
  type TagCatalogsByBucket,
} from '@/services/profile/tagCatalog';
import { MentorProfileVO } from '@/services/profile/user';
import type { TagVO } from '@/types/tag';

import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  useUserProfileDto,
} from './useUserProfileDto';

// Re-exported under the historical names so existing callers (e.g.
// useProfileSubmit, useUserData.test) continue to work without churn.
export const clearUserDataCache = clearUserProfileDtoCache;
export const primeUserDataCache = primeUserProfileDtoCache;
export const USER_DATA_CACHE_TTL_MS = USER_PROFILE_DTO_CACHE_TTL_MS;

export interface TagDisplay {
  subject_group: string;
  subject: string;
}

export interface WorkExperienceMetadata {
  job?: string;
  company?: string;
  job_period_start?: string;
  job_period_end?: string;
  job_location?: string;
  description?: string;
  industry?: string;
  is_primary?: boolean;
}

export interface EducationExperienceMetadata {
  subject?: string;
  school?: string;
  education_period_start?: string;
  education_period_end?: string;
}

export interface PersonalLinkMetadata {
  platform: string;
  url: string;
}

export interface UserType {
  user_id: number;
  name: string;
  avatar: string;
  job_title: string;
  company: string;
  is_mentor: boolean;
  about?: string;
  years_of_experience?: string;
  industry?: string;
  want_position: TagDisplay[];
  want_skill: TagDisplay[];
  want_topic: TagDisplay[];
  have_skill: TagDisplay[];
  have_topic: TagDisplay[];
  workExperiences?: WorkExperienceMetadata[];
  educations?: EducationExperienceMetadata[];
  personalLinks?: PersonalLinkMetadata[];
}

type ExperienceBlock = {
  category: ExperienceType;
  mentor_experiences_metadata?: { data?: unknown[] };
};

// Subject_group codes shipped by the BFF round-trip directly back to writes,
// so resolve them to display labels via the localized catalog. Catalog miss
// (legacy or unpublished tag) falls back to the raw code rather than dropping
// the chip silently.
function toTagDisplay(
  codes: ReadonlyArray<string> | null | undefined,
  labelMap: Map<string, string>
): TagDisplay[] {
  if (!codes) return [];
  return codes
    .filter((c): c is string => Boolean(c))
    .map((subject_group) => ({
      subject_group,
      subject: labelMap.get(subject_group) ?? subject_group,
    }));
}

function getBlocksByCategory(
  experiences: MentorProfileVO['experiences'],
  category: ExperienceType
): ExperienceBlock[] {
  if (!experiences) return [];
  return (experiences as unknown as ExperienceBlock[]).filter(
    (exp) => exp.category === category
  );
}

function getMetadataArray<T>(block: ExperienceBlock): T[] {
  return (block.mentor_experiences_metadata?.data ?? []) as T[];
}

function parseUserDtoToUserType(
  userDto: MentorProfileVO,
  catalogs: TagCatalogsByBucket
): UserType {
  const labelMap = buildTagLabelMap(catalogs);

  const workBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.WORK
  );
  const educationBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.EDUCATION
  );
  const linkBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.LINK
  );

  const workExperiences = workBlocks.flatMap((b) =>
    getMetadataArray<WorkExperienceMetadata>(b)
  );
  const educations = educationBlocks.flatMap((b) =>
    getMetadataArray<EducationExperienceMetadata>(b)
  );
  // Drop links whose URL doesn't pass the scheme allow-list. The form schema
  // already blocks javascript:, but profiles can be written via direct BFF
  // calls — render-time filtering closes that bypass before <a href> ever
  // sees the value.
  const personalLinks = linkBlocks
    .flatMap((b) => getMetadataArray<PersonalLinkMetadata>(b))
    .filter((l) => isSafeUrl(l.url));

  // BFF emits industry enriched (TagVO-shaped); OpenAPI types it as
  // `Record<string, never>`. Pull subject through the local TagVO type.
  const industryTag = userDto.industry as unknown as TagVO | null | undefined;

  return {
    user_id: userDto.user_id,
    name: userDto.name ?? '',
    avatar: userDto.avatar ?? '',
    job_title: userDto.job_title ?? '',
    company: userDto.company ?? '',
    is_mentor: userDto.is_mentor ?? false,
    about: userDto.about ?? '',
    years_of_experience: userDto.years_of_experience
      ? (TotalWorkSpanEnum[
          userDto.years_of_experience as keyof typeof TotalWorkSpanEnum
        ] ?? userDto.years_of_experience)
      : undefined,
    industry: industryTag?.subject ?? undefined,
    want_position: toTagDisplay(userDto.want_position, labelMap),
    want_skill: toTagDisplay(userDto.want_skill, labelMap),
    want_topic: toTagDisplay(userDto.want_topic, labelMap),
    have_skill: toTagDisplay(userDto.have_skill, labelMap),
    have_topic: toTagDisplay(userDto.have_topic, labelMap),
    workExperiences,
    educations,
    personalLinks,
  };
}

function useUserData(userId: number, language: string) {
  const {
    userDto,
    isLoading: dtoLoading,
    error,
  } = useUserProfileDto(userId, language);
  // Catalog supplies localized labels for the raw subject_group arrays
  // (want_*, have_*) and for the enriched industry. Loads in parallel with
  // the user dto and is cached app-wide via getTagCatalogCached.
  const tagCatalog = useTagCatalog(language);

  const userData: UserType | null = userDto
    ? parseUserDtoToUserType(userDto, tagCatalog)
    : null;

  return { userData, isLoading: dtoLoading, error };
}

export default useUserData;

import { TotalWorkSpanEnum } from '@/constant/seniority';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import {
  decode,
  type EducationExperienceMetadata,
  type MentorExperiencePayload,
  type PersonalLinkMetadata,
  type WorkExperienceMetadata,
} from '@/lib/profile/experienceCodec';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

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

function parseUserDtoToUserType(
  userDto: MentorProfileVO,
  catalogs: TagCatalogsByBucket
): UserType {
  const labelMap = buildTagLabelMap(catalogs);

  const { workExperiences, educations, personalLinks } = decode(
    userDto.experiences as unknown as MentorExperiencePayload[]
  );

  // BFF emits industry enriched (TagVO-shaped); OpenAPI types it as
  // `Record<string, never>`. Pull subject through the local TagVO type.
  const industryTag = readIndustryTag(userDto.industry);

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

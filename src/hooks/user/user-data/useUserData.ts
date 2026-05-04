import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import { ExperienceType } from '@/services/profile/experienceType';
import { MentorProfileVO } from '@/services/profile/user';
import type { components } from '@/types/api';

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

type TagVO = components['schemas']['TagVO'];

function toTagDisplay(tags: TagVO[] | null | undefined): TagDisplay[] {
  if (!tags) return [];
  return tags
    .map((t) => ({
      subject_group: t.subject_group ?? '',
      subject: t.subject ?? t.subject_group ?? '',
    }))
    .filter((t) => t.subject_group);
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

function parseUserDtoToUserType(userDto: MentorProfileVO): UserType {
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
  const personalLinks = linkBlocks
    .flatMap((b) => getMetadataArray<PersonalLinkMetadata>(b))
    .filter((l) => Boolean(l.url));

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
    industry: userDto.industry?.subject ?? undefined,
    want_position: toTagDisplay(userDto.want_position),
    want_skill: toTagDisplay(userDto.want_skill),
    want_topic: toTagDisplay(userDto.want_topic),
    have_skill: toTagDisplay(userDto.have_skill),
    have_topic: toTagDisplay(userDto.have_topic),
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

  const userData: UserType | null = userDto
    ? parseUserDtoToUserType(userDto)
    : null;

  return { userData, isLoading: dtoLoading, error };
}

export default useUserData;

import { useEffect, useState } from 'react';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import { parseCurrentJob } from '@/lib/profile/parseUserExperiences';
import { ExperienceType } from '@/services/profile/experienceType';
import { MentorProfileVO } from '@/services/profile/user';

import {
  getInterestsCached,
  type InterestsResult,
} from '../interests/useInterests';
import {
  clearUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  useUserProfileDto,
} from './useUserProfileDto';

// Re-exported under the historical names so existing callers (e.g.
// useProfileSubmit, useUserData.test) continue to work without churn.
export const clearUserDataCache = clearUserProfileDtoCache;
export const USER_DATA_CACHE_TTL_MS = USER_PROFILE_DTO_CACHE_TTL_MS;

export interface InterestType {
  subject_group: string;
  subject: string;
}

export interface WorkExperienceMetadata {
  job?: string;
  company?: string;
  jobPeriodStart?: string;
  jobPeriodEnd?: string;
  jobLocation?: string;
  description?: string;
  industry?: string;
  isPrimary?: boolean;
}

export interface EducationExperienceMetadata {
  subject?: string;
  school?: string;
  educationPeriodStart?: string;
  educationPeriodEnd?: string;
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
  interested_positions: InterestType[];
  skills: InterestType[];
  topics: InterestType[];
  is_mentor: boolean;
  about?: string;
  years_of_experience?: string;
  industry?: string;
  expertises?: InterestType[];
  what_i_offers?: InterestType[];
  workExperiences?: WorkExperienceMetadata[];
  educations?: EducationExperienceMetadata[];
  personalLinks?: PersonalLinkMetadata[];
}

type ExperienceBlock = {
  category: ExperienceType;
  mentor_experiences_metadata?: { data?: unknown[] };
};

type WhatIOfferMetadata = { subject_group: string };

type InterestVO = NonNullable<MentorProfileVO['topics']>['interests'][number];

function toInterestList(interests: InterestVO[]): InterestType[] {
  return interests.map((i) => ({
    subject_group: i.subject_group,
    subject: i.subject ?? '',
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

function buildWhatIOffers(
  offerBlocks: ExperienceBlock[],
  labelByGroup: Map<string, string>
): InterestType[] {
  const subjectGroups = offerBlocks
    .flatMap((b) => getMetadataArray<WhatIOfferMetadata>(b))
    .map((m) => m.subject_group)
    .filter(Boolean);

  const uniqueSubjectGroups = Array.from(new Set(subjectGroups));

  return uniqueSubjectGroups.map((subject_group) => ({
    subject_group,
    subject: labelByGroup.get(subject_group) ?? subject_group,
  }));
}

function parseUserDtoToUserType(
  userDto: MentorProfileVO,
  labelByGroup: Map<string, string>
): UserType {
  const workBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.WORK
  );
  const educationBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.EDUCATION
  );
  const offerBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.WHAT_I_OFFER
  );
  const linkBlocks = getBlocksByCategory(
    userDto.experiences,
    ExperienceType.LINK
  );

  const { job_title, company } = parseCurrentJob(
    userDto.experiences as {
      category: string;
      mentor_experiences_metadata: unknown;
    }[]
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

  const what_i_offers = buildWhatIOffers(offerBlocks, labelByGroup);

  const expertises: InterestType[] =
    userDto.expertises?.professions?.map((p) => ({
      subject_group: p.subject_group,
      subject: p.subject,
    })) ?? [];

  return {
    user_id: userDto.user_id,
    name: userDto.name ?? '',
    avatar: userDto.avatar ?? '',
    job_title,
    company,
    interested_positions: toInterestList(
      userDto.interested_positions?.interests ?? []
    ),
    skills: toInterestList(userDto.skills?.interests ?? []),
    topics: toInterestList(userDto.topics?.interests ?? []),
    is_mentor: userDto.is_mentor ?? false,
    about: userDto.about ?? '',
    years_of_experience: userDto.years_of_experience
      ? (TotalWorkSpanEnum[
          userDto.years_of_experience as keyof typeof TotalWorkSpanEnum
        ] ?? userDto.years_of_experience)
      : undefined,
    industry: userDto.industry?.subject ?? undefined,
    expertises,
    what_i_offers,
    workExperiences,
    educations,
    personalLinks,
  };
}

function useUserData(userId: number, language: string) {
  const { userDto, isLoading, error } = useUserProfileDto(userId, language);
  const [userData, setUserData] = useState<UserType | null>(null);

  useEffect(() => {
    if (!userDto || !language) {
      if (!userDto) setUserData(null);
      return;
    }

    let cancelled = false;

    getInterestsCached(language)
      .then((interests: InterestsResult) => {
        if (cancelled) return;
        const labelByGroup = new Map(
          interests.whatIOffers.map(
            (item) => [item.subject_group, item.subject ?? ''] as const
          )
        );
        setUserData(parseUserDtoToUserType(userDto, labelByGroup));
      })
      .catch((e) => {
        // Interests-fetch failure leaves the previously rendered userData
        // intact; surface only via console to keep the UX stable.
        console.error('Failed to load interests for user:', e);
      });

    return () => {
      cancelled = true;
    };
  }, [userDto, language]);

  return { userData, isLoading, error };
}

export default useUserData;

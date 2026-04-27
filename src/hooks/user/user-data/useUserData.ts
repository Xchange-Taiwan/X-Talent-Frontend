import { useEffect, useState } from 'react';

import { TotalWorkSpanEnum } from '@/components/onboarding/steps/constant';
import { parseCurrentJob } from '@/lib/profile/parseUserExperiences';
import { ExperienceType } from '@/services/profile/experienceType';
import { fetchUserById, MentorProfileVO } from '@/services/profile/user';

import {
  getInterestsCached,
  type InterestsResult,
} from '../interests/useInterests';

export const USER_DATA_CACHE_TTL_MS = 60_000;

interface CachedUserDtoEntry {
  data: MentorProfileVO;
  expiresAt: number;
}

interface CachedReadResult {
  data: MentorProfileVO;
  isStale: boolean;
}

const userDtoDataCache = new Map<string, CachedUserDtoEntry>();
const userDtoPromiseCache = new Map<string, Promise<MentorProfileVO | null>>();

function readFromDataCache(key: string): CachedReadResult | undefined {
  const entry = userDtoDataCache.get(key);
  if (!entry) return undefined;
  return { data: entry.data, isStale: entry.expiresAt <= Date.now() };
}

/**
 * Removes a user's entry from the in-memory cache so the next call to
 * useUserData for that user triggers a fresh API fetch.  Call this after a
 * successful profile update to prevent any concurrent mount from receiving
 * stale data.
 */
export function clearUserDataCache(userId: number, language: string): void {
  const key = `${userId}-${language}`;
  userDtoDataCache.delete(key);
  userDtoPromiseCache.delete(key);
}

// Promise-deduped fetch: writes to the data cache on success so subsequent
// readers (including a parallel-mounted hook) see the fresh entry. Concurrent
// callers share the same in-flight promise to avoid duplicate network calls.
function startFetchUserById(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  const key = `${userId}-${language}`;

  const inflight = userDtoPromiseCache.get(key);
  if (inflight) return inflight;

  const promise = fetchUserById(userId, language)
    .then((data) => {
      if (data) {
        userDtoDataCache.set(key, {
          data,
          expiresAt: Date.now() + USER_DATA_CACHE_TTL_MS,
        });
      }
      return data;
    })
    .finally(() => {
      userDtoPromiseCache.delete(key);
    });
  userDtoPromiseCache.set(key, promise);
  return promise;
}

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
  const [userData, setUserData] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    const isLanguageValid = Boolean(language);

    if (!isUserIdValid || !isLanguageValid) {
      setUserData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const key = `${userId}-${language}`;
    const cachedEntry = readFromDataCache(key);
    const interestsPromise = getInterestsCached(language);

    const applyData = (
      userDto: MentorProfileVO,
      interests: InterestsResult
    ) => {
      if (cancelled) return;
      const labelByGroup = new Map(
        interests.whatIOffers.map(
          (item) => [item.subject_group, item.subject ?? ''] as const
        )
      );
      setUserData(parseUserDtoToUserType(userDto, labelByGroup));
      setError(null);
    };

    // Cached path: render immediately from cache, then optionally
    // revalidate in the background. Only a missing cache entry triggers
    // a blocking load.
    if (cachedEntry) {
      setIsLoading(false);
      interestsPromise
        .then((interests) => applyData(cachedEntry.data, interests))
        .catch((e) => {
          console.error('Failed to load interests for cached user:', e);
        });

      if (cachedEntry.isStale) {
        Promise.all([startFetchUserById(userId, language), interestsPromise])
          .then(([userDto, interests]) => {
            if (cancelled || !userDto) return;
            applyData(userDto, interests);
          })
          .catch((e) => {
            // Background revalidation failure: keep showing stale data,
            // surface only via console (no error state flip).
            console.error('Background user-data refetch failed:', e);
          });
      }

      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);

    Promise.all([startFetchUserById(userId, language), interestsPromise])
      .then(([userDto, interests]) => {
        if (cancelled) return;
        if (!userDto) {
          setUserData(null);
          setError('User not found');
          return;
        }
        applyData(userDto, interests);
      })
      .catch((e) => {
        console.error('Failed to load user:', e);
        if (cancelled) return;
        setUserData(null);
        setError('Failed to load user data');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, language]);

  return { userData, isLoading, error };
}

export default useUserData;

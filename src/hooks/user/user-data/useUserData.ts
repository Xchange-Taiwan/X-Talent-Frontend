import { useEffect, useState } from 'react';

import { ExperienceType } from '@/services/profile/experienceType';
import { fetchUserById, UserDTO } from '@/services/profile/user';

import { getInterestsCached } from '../interests/useInterests';

const userDtoPromiseCache = new Map<string, Promise<UserDTO | null>>();

function fetchUserByIdCached(
  userId: number,
  language: string
): Promise<UserDTO | null> {
  const key = `${userId}-${language}`;
  const inflight = userDtoPromiseCache.get(key);
  if (inflight) return inflight;

  const promise = fetchUserById(userId, language).finally(() => {
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
  description?: string;
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

function toInterestList(
  interests: UserDTO['topics']['interests']
): InterestType[] {
  return interests.map((i) => ({
    subject_group: i.subject_group,
    subject: i.subject,
  }));
}

function getBlocksByCategory(
  experiences: UserDTO['experiences'] | undefined,
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
  userDto: UserDTO,
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

  const firstWork = workBlocks[0];
  const firstWorkMetadata = firstWork
    ? getMetadataArray<WorkExperienceMetadata>(firstWork)[0]
    : undefined;

  const job_title = firstWorkMetadata?.job ?? userDto.job_title ?? '';
  const company = firstWorkMetadata?.company ?? userDto.company ?? '';

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
    name: userDto.name,
    avatar: userDto.avatar,
    job_title,
    company,
    interested_positions: toInterestList(
      userDto.interested_positions.interests
    ),
    skills: toInterestList(userDto.skills.interests),
    topics: toInterestList(userDto.topics.interests),
    is_mentor: userDto.is_mentor,
    about: userDto.about ?? '',
    expertises,
    what_i_offers,
    workExperiences,
    educations,
    personalLinks,
  };
}

const useUserData = (userId: number, language: string) => {
  const [userData, setUserData] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
      const isLanguageValid = Boolean(language);

      if (!isUserIdValid || !isLanguageValid) {
        setUserData(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [userDto, interests] = await Promise.all([
          fetchUserByIdCached(userId, language),
          getInterestsCached(language),
        ]);

        if (cancelled) return;

        if (!userDto) {
          setUserData(null);
          setError('User not found');
          return;
        }

        const labelByGroup = new Map(
          interests.whatIOffers.map(
            (item) => [item.subject_group, item.subject] as const
          )
        );

        setUserData(parseUserDtoToUserType(userDto, labelByGroup));
      } catch (e) {
        console.error('Failed to load user:', e);
        if (cancelled) return;
        setUserData(null);
        setError('Failed to load user data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [userId, language]);

  return { userData, isLoading, error };
};

export default useUserData;

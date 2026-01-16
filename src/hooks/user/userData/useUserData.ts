import { useEffect, useState } from 'react';

import { ExperienceType } from '@/services/profile/experienceType';
import { fetchUserById } from '@/services/profile/user';
import { UserDTO } from '@/services/profile/user';

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
  mentor_experiences_metadata?: {
    data?: unknown[]; // refined per category below via narrowing
  };
};

type WhatIOfferMetadata = {
  subject_group: string;
  subject?: string;
};

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

  // If your ExperienceType is already well-typed, you can remove this cast
  // and just use experiences.filter(e => e.category === category).
  return (experiences as unknown as ExperienceBlock[]).filter(
    (exp) => exp.category === category
  );
}

function getMetadataArray<T>(block: ExperienceBlock): T[] {
  // We assume backend shape is `{ mentor_experiences_metadata: { data: T[] } }`
  // If absent, return empty.
  const data = block.mentor_experiences_metadata?.data ?? [];
  return data as T[];
}

function parseUserDtoToUserType(userDto: UserDTO): UserType {
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

  const primaryJobTitle = firstWorkMetadata?.job ?? userDto.job_title ?? '';
  const primaryCompany = firstWorkMetadata?.company ?? userDto.company ?? '';

  const workExperiences = workBlocks.flatMap((b) =>
    getMetadataArray<WorkExperienceMetadata>(b)
  );

  const educations = educationBlocks.flatMap((b) =>
    getMetadataArray<EducationExperienceMetadata>(b)
  );

  const personalLinks = linkBlocks
    .flatMap((b) => getMetadataArray<PersonalLinkMetadata>(b))
    .filter((l) => Boolean(l.url));

  const whatIOffers = offerBlocks.flatMap((b) =>
    getMetadataArray<WhatIOfferMetadata>(b).map((m) => ({
      subject_group: m.subject_group,
      subject: m.subject ?? m.subject_group,
    }))
  );

  const expertises: InterestType[] =
    userDto.expertises?.professions?.map((p) => ({
      subject_group: p.subject_group,
      subject: p.subject,
    })) ?? [];

  return {
    user_id: userDto.user_id,
    name: userDto.name,
    avatar: userDto.avatar,
    job_title: primaryJobTitle,
    company: primaryCompany,
    interested_positions: toInterestList(
      userDto.interested_positions.interests
    ),
    skills: toInterestList(userDto.skills.interests),
    topics: toInterestList(userDto.topics.interests),
    is_mentor: userDto.is_mentor,
    about: userDto.about ?? '',
    expertises,
    what_i_offers: whatIOffers,
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
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    const isLanguageValid = Boolean(language);

    if (!isUserIdValid || !isLanguageValid) {
      setUserData(null);
      setError(null);
      return;
    }

    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const userDto = await fetchUserById(userId, language);

        if (!userDto) {
          setUserData(null);
          setError('User not found');
          return;
        }

        setUserData(parseUserDtoToUserType(userDto));
      } catch (e) {
        console.error('Failed to fetch user:', e);
        setUserData(null);
        setError('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, language]);

  return { userData, isLoading, error };
};

export default useUserData;

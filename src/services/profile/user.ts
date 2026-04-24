import { getSession } from 'next-auth/react';

import { apiClient } from '@/lib/apiClient';

import { ExpertiseType } from './expertises';
import { IndustryDTO } from './industries';
import { InterestDTO } from './interests';

export interface ExperienceType {
  [key: string]: unknown;
}

export interface UserDTO {
  user_id: number;
  name: string;
  avatar: string;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  interested_positions: {
    interests: InterestDTO[];
    language: string | null;
  };
  skills: {
    interests: InterestDTO[];
    language: string | null;
  };
  topics: {
    interests: InterestDTO[];
    language: string | null;
  };
  industry: IndustryDTO;
  onboarding: boolean;
  is_mentor: boolean;
  language: string;
  personal_statement?: string;
  about?: string;
  seniority_level?: string;
  expertises?: {
    professions: ExpertiseType[];
    language: string | null;
  };
  experiences?: ExperienceType[];
}

interface UserResponseDTO {
  code: string;
  msg: string;
  data: UserDTO;
}

export async function fetchUser(language: string): Promise<UserDTO | null> {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error('未找到使用者 ID。請重新登入。');
  }

  return fetchUserById(Number(userId), language);
}

export async function fetchUserById(
  userId: number,
  language: string
): Promise<UserDTO | null> {
  try {
    const result = await apiClient.get<UserResponseDTO>(
      `/v1/mentors/${userId}/${language}/profile`,
      { auth: false }
    );

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error('Fetch User Error:', error);
    return null;
  }
}

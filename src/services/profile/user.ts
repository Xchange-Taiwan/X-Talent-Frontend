import { getSession } from 'next-auth/react';

import { ExpertiseType } from './expertises';
import { IndustryType } from './industries';
import { InterestType } from './interests';

export interface ExperienceType {
  [key: string]: unknown;
}

export interface UserType {
  user_id: number;
  name: string;
  avatar: string;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  interested_positions: {
    interests: InterestType[];
    language: string | null;
  };
  skills: {
    interests: InterestType[];
    language: string | null;
  };
  topics: {
    interests: InterestType[];
    language: string | null;
  };
  industry: IndustryType;
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

interface UserResponse {
  code: string;
  msg: string;
  data: UserType;
}

export async function fetchUser(language: string): Promise<UserType | null> {
  const session = await getSession();
  const token = session?.accessToken;
  const userId = session?.user?.id;

  if (!token) {
    throw new Error('未找到授權令牌。請重新登入。');
  }

  return fetchUserById(Number(userId), language, token);
}

export async function fetchUserById(
  userId: number,
  language: string,
  token?: string,
): Promise<UserType | null> {
  if (!token) {
    const session = await getSession();
    token = session?.accessToken;
  }

  if (!token) {
    throw new Error('未找到授權令牌。請重新登入。');
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${userId}/${language}/profile`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result: UserResponse = await response.json();

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

export async function updateUserProfile(
  userData: Partial<UserType>,
): Promise<boolean> {
  const session = await getSession();
  const token = session?.accessToken;
  const userId = session?.user?.id;

  if (!token || !userId) {
    throw new Error('未找到授權令牌或使用者 ID。請重新登入。');
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors/${userId}/profile`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      },
    );

    if (!response.ok) {
      console.error('Failed to update profile:', response.statusText);
      return false;
    }

    const result = await response.json();

    if (result.code !== '0') {
      console.error('API Error:', result.msg);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update User Error:', error);
    return false;
  }
}

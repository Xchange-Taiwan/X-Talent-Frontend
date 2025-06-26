import { getSession } from 'next-auth/react';

import { IndustryType } from './industries';
import { InterestType } from './interests';

export interface UserType {
  user_id: number;
  name: string;
  avatar: string;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  linkedin_profile: string;
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

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/users/${userId}/${language}/profile`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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

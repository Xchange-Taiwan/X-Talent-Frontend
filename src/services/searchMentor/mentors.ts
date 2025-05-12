import { getSession } from 'next-auth/react';

export interface IndustryType {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  profession_metadata: {
    desc: string;
    icon: string;
  };
}

export interface InterestType {
  id: number;
  category: string;
  language: string;
  subject_group: string;
  subject: string;
  desc: {
    desc?: string;
    icon?: string;
  };
}

export interface MentorType {
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
  personal_statement: string;
  about: string;
  seniority_level: string;
  expertises: {
    professions: [];
  };
  update_at: number;
  views: number;
}

interface MentorResponse {
  code: string;
  msg: string;
  data: MentorType[];
}

export async function fetchMentors(): Promise<MentorType[] | []> {
  const session = await getSession();
  const token = session?.accessToken;

  if (!token) {
    throw new Error('未找到授權令牌。請重新登入。');
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mentors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result: MentorResponse = await response.json();

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return [];
    }

    return result.data;
  } catch (error) {
    console.error('Fetch User Error:', error);
    return [];
  }
}

import { StaticImageData } from 'next/image';

export interface experienceType {
  duration: string;
  company: string;
  title: string;
}

export interface MentorType {
  user_id: number;
  name: string;
  avatar: string | StaticImageData;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  linkedin_profile: string;
  interested_positions: [];
  skills: [];
  topics: [];
  industry: string;
  language: string;
  personal_statement: string;
  about: string;
  seniority_level: string;
  expertises: [];
  experiences: experienceType[];
  created_at: string;
  updated_at: string;
}

export interface MentorRequest {
  searchPattern?: string;
  filter_positions?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_expertises?: string;
  filter_industries?: string;
  limit: number;
  cursor?: string;
}

interface MentorResponse {
  code: string;
  msg: string;
  data: MentorType[];
}

export async function fetchMentors(
  param: MentorRequest,
): Promise<MentorType[] | []> {
  try {
    const query = new URLSearchParams();
    Object.entries(param).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/mentors?${query.toString()}`,
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

    const result: MentorResponse = await response.json();

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return [];
    }

    return result.data;
  } catch (error) {
    console.error('Fetch Mentors Error:', error);
    return [];
  }
}

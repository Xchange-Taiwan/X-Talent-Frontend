import type { StaticImageData } from 'next/image';

import avatarImage from '@/assets/default-avatar.png';
import type { WorkExperienceMetadata } from '@/hooks/user/user-data/useUserData';
import type { components } from '@/types/api';

type RawMentor = components['schemas']['SearchMentorProfileVO'];

export type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];

export type { WorkExperienceMetadata };

export interface MentorType {
  user_id: number;
  name: string;
  avatar: string | StaticImageData;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  personal_statement: string;
  about: string;
  seniority_level: string;
  industry: string | null;
  want_position: string[];
  want_skill: string[];
  want_topic: string[];
  have_skill: string[];
  have_topic: string[];
  updated_at: number | null;
}

function readCodes(codes: ReadonlyArray<string> | null | undefined): string[] {
  if (!codes) return [];
  return codes.filter((c): c is string => Boolean(c));
}

export type MentorsType = components['schemas']['SearchMentorProfileListVO'];

export interface MentorRequest {
  // snake_case to match the BFF/Search query param exactly. Object.entries
  // in mentors.server.ts / mentors.ts forwards keys verbatim into the URL,
  // so a camelCase key here would silently be dropped by FastAPI's
  // search_pattern: str = Query(None) and the keyword would have no effect.
  search_pattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  limit: number;
  cursor?: string;
}

export function mapMentor(raw: RawMentor): MentorType {
  // Search emits industry as a flat subject_group string (OpenSearch keyword
  // mapping); the OpenAPI generator types it as `Record<string, never>`
  // because BFF inherits from MentorProfileVO whose industry is a Dict on
  // the User-service GET response. The runtime value is a string here.
  const industry = raw.industry as unknown as string | null | undefined;

  return {
    user_id: raw.user_id,
    name: raw.name ?? '',
    avatar: raw.avatar ?? '',
    job_title: raw.job_title ?? '',
    company: raw.company ?? '',
    years_of_experience: raw.years_of_experience ?? '',
    location: raw.location ?? '',
    personal_statement: raw.personal_statement ?? '',
    about: raw.about ?? '',
    seniority_level: raw.seniority_level ?? '',
    industry: industry ?? null,
    want_position: readCodes(raw.want_position),
    want_skill: readCodes(raw.want_skill),
    want_topic: readCodes(raw.want_topic),
    have_skill: readCodes(raw.have_skill),
    have_topic: readCodes(raw.have_topic),
    updated_at: raw.updated_at ?? null,
  };
}

// Cache-bust the avatar URL by updated_at so a re-uploaded photo doesn't
// serve a stale CDN copy; falls back to the local placeholder when a mentor
// has no avatar. Shared by both the SSR listing fetch and client-side
// (filtered / load-more) fetches so the two paths render identically.
export function resolveMentorAvatar(mentor: MentorType): MentorType {
  return {
    ...mentor,
    avatar:
      typeof mentor.avatar === 'string' && mentor.avatar
        ? `${mentor.avatar}${mentor.updated_at ? `?cb=${mentor.updated_at}` : ''}`
        : avatarImage,
  };
}

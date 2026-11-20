import {
  type NormalizedPersonalLink,
  projectUserProfile,
} from '@/lib/profile/profileProjection';
import type { MentorProfileVO } from '@/types/user';

export interface PublicMentorProfile {
  userId: number;
  name: string;
  avatar: string | null;
  jobTitle: string;
  company: string;
  about: string;
  industry: string | null;
  expertises: string[];
  topics: string[];
  isMentor: boolean;
  personalLinks: NormalizedPersonalLink[];
}

/**
 * Build a sanitized public projection of the mentor profile for SEO/JSON-LD
 * directly on top of the shared `projectUserProfile` core so client views and
 * SSR metadata/JSON-LD never diverge on primary role, industry, tag labels, or
 * personal-link deduplication.
 *
 * Pass `labelMap` to translate raw subject_group codes (the wire format for
 * have_skill/have_topic and industry) into localized labels; without it the
 * codes pass through, which still works for crawlers but degrades zh_TW
 * relevance.
 */
export function sanitizePublicProfile(
  profile: MentorProfileVO,
  labelMap?: ReadonlyMap<string, string>
): PublicMentorProfile {
  const projected = projectUserProfile(profile, { labelMap });

  return {
    userId: projected.user_id,
    name: projected.name,
    avatar: projected.avatar || null,
    jobTitle: projected.job_title,
    company: projected.company,
    about: projected.about ?? '',
    industry: projected.industry ?? null,
    expertises: projected.have_skill.map((tag) => tag.subject),
    topics: projected.have_topic.map((tag) => tag.subject),
    isMentor: projected.is_mentor,
    personalLinks: projected.personalLinks,
  };
}

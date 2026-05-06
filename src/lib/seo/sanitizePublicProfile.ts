import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileVO } from '@/services/profile/user';
import type { TagVO } from '@/types/tag';

export type SocialPlatform =
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'youtube'
  | 'website';

const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'linkedin',
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'website',
];

export interface PublicPersonalLink {
  platform: SocialPlatform;
  url: string;
}

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
  personalLinks: PublicPersonalLink[];
}

interface ExperienceBlock {
  category?: string | null;
  mentor_experiences_metadata?: { data?: unknown[] } | null;
}

interface WorkMetadata {
  job?: string;
  company?: string;
  is_primary?: boolean;
}

interface LinkMetadata {
  platform?: string;
  url?: string;
}

function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getBlocks(
  experiences: MentorProfileVO['experiences'] | null | undefined,
  category: string
): ExperienceBlock[] {
  if (!experiences) return [];
  return (experiences as unknown as ExperienceBlock[]).filter(
    (e) => e.category === category
  );
}

function getMetadataItems<T>(block: ExperienceBlock): T[] {
  return (block.mentor_experiences_metadata?.data ?? []) as T[];
}

function pickCurrentJob(profile: MentorProfileVO): {
  jobTitle: string;
  company: string;
} {
  const workEntries = getBlocks(
    profile.experiences,
    ExperienceType.WORK
  ).flatMap((block) => getMetadataItems<WorkMetadata>(block));

  if (workEntries.length === 0) {
    return {
      jobTitle: profile.job_title ?? '',
      company: profile.company ?? '',
    };
  }

  const current =
    workEntries.find((entry) => entry.is_primary) ?? workEntries[0];

  return {
    jobTitle: current.job ?? profile.job_title ?? '',
    company: current.company ?? profile.company ?? '',
  };
}

function pickPublicLinks(profile: MentorProfileVO): PublicPersonalLink[] {
  const links = getBlocks(profile.experiences, ExperienceType.LINK).flatMap(
    (block) => getMetadataItems<LinkMetadata>(block)
  );

  const seen = new Set<SocialPlatform>();
  const result: PublicPersonalLink[] = [];

  for (const link of links) {
    const platform = link.platform as SocialPlatform | undefined;
    const url = link.url ?? '';
    if (
      platform &&
      SOCIAL_PLATFORMS.includes(platform) &&
      isHttpsUrl(url) &&
      !seen.has(platform)
    ) {
      seen.add(platform);
      result.push({ platform, url });
    }
  }

  return result;
}

function resolveLabels(
  codes: ReadonlyArray<string> | null | undefined,
  labelMap?: Map<string, string>
): string[] {
  if (!codes) return [];
  return codes
    .filter((c): c is string => Boolean(c))
    .map((code) => labelMap?.get(code) ?? code);
}

/**
 * Build a sanitized public projection of the mentor profile for SEO/JSON-LD.
 * Pass `labelMap` to translate raw subject_group codes (the wire format for
 * have_skill/have_topic) into localized labels; without it the codes pass
 * through, which still works for crawlers but degrades zh_TW relevance.
 */
export function sanitizePublicProfile(
  profile: MentorProfileVO,
  labelMap?: Map<string, string>
): PublicMentorProfile {
  const { jobTitle, company } = pickCurrentJob(profile);

  const expertises = resolveLabels(profile.have_skill, labelMap);
  const topics = resolveLabels(profile.have_topic, labelMap);

  // BFF emits industry as an enriched TagVO-shaped object even though the
  // OpenAPI generator types it as `Record<string, never>`. Fall back to the
  // raw subject_group key when the localized subject is missing.
  const industryTag = profile.industry as unknown as TagVO | null | undefined;
  const industry = industryTag?.subject ?? industryTag?.subject_group ?? null;

  return {
    userId: profile.user_id,
    name: profile.name ?? '',
    avatar: profile.avatar || null,
    jobTitle,
    company,
    about: profile.about ?? '',
    industry,
    expertises,
    topics,
    isMentor: Boolean(profile.is_mentor),
    personalLinks: pickPublicLinks(profile),
  };
}

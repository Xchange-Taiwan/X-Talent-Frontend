import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileVO } from '@/services/profile/user';

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
  isPrimary?: boolean;
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
    workEntries.find((entry) => entry.isPrimary) ?? workEntries[0];

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

export function sanitizePublicProfile(
  profile: MentorProfileVO
): PublicMentorProfile {
  const { jobTitle, company } = pickCurrentJob(profile);

  const expertises =
    profile.have_skill?.map((t) => t.subject ?? '').filter(Boolean) ?? [];

  const topics =
    profile.have_topic?.map((t) => t.subject ?? '').filter(Boolean) ?? [];

  return {
    userId: profile.user_id,
    name: profile.name ?? '',
    avatar: profile.avatar || null,
    jobTitle,
    company,
    about: profile.about ?? '',
    industry: profile.industry?.subject ?? null,
    expertises,
    topics,
    isMentor: Boolean(profile.is_mentor),
    personalLinks: pickPublicLinks(profile),
  };
}

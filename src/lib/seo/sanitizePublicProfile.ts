import type { MentorExperiencePayload } from '@/lib/profile/experienceCodec';
import { decode } from '@/lib/profile/experienceCodec';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { isSafeUrl } from '@/lib/url/isSafeUrl';
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

function mapExperiences(
  experiences: MentorProfileVO['experiences'] | null | undefined
): MentorExperiencePayload[] | undefined {
  if (!experiences) return undefined;
  return experiences.map((exp) => ({
    category: exp.category ?? '',
    mentor_experiences_metadata: (exp.mentor_experiences_metadata ??
      {}) as Record<string, unknown>,
    order: exp.order ?? 0,
  }));
}

function pickCurrentJob(
  profile: MentorProfileVO,
  workExperiences: ReturnType<typeof decode>['workExperiences']
): {
  jobTitle: string;
  company: string;
} {
  if (workExperiences.length === 0) {
    return {
      jobTitle: profile.job_title ?? '',
      company: profile.company ?? '',
    };
  }

  const current =
    workExperiences.find((entry) => entry.is_primary) ?? workExperiences[0];

  return {
    jobTitle: current.job ?? profile.job_title ?? '',
    company: current.company ?? profile.company ?? '',
  };
}

function pickPublicLinks(
  decodedLinks: ReturnType<typeof decode>['personalLinks']
): PublicPersonalLink[] {
  const seen = new Set<SocialPlatform>();
  const result: PublicPersonalLink[] = [];

  for (const link of decodedLinks) {
    const platform = link.platform as SocialPlatform | undefined;
    const url = link.url;
    if (
      platform &&
      SOCIAL_PLATFORMS.includes(platform) &&
      url &&
      isSafeUrl(url) &&
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
  const decoded = decode(mapExperiences(profile.experiences));

  const { jobTitle, company } = pickCurrentJob(
    profile,
    decoded.workExperiences
  );

  const expertises = resolveLabels(profile.have_skill, labelMap);
  const topics = resolveLabels(profile.have_topic, labelMap);

  // BFF emits industry as an enriched TagVO-shaped object even though the
  // OpenAPI generator types it as `Record<string, never>`. Fall back to the
  // raw subject_group key when the localized subject is missing.
  const industryTag = readIndustryTag(profile.industry);
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
    personalLinks: pickPublicLinks(decoded.personalLinks),
  };
}

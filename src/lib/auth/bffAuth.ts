import type { User } from 'next-auth';

import { isSafeUrl } from '@/lib/url/isSafeUrl';

export interface MentorExperience {
  category: string;
  mentor_experiences_metadata?: {
    data?: unknown[];
  };
}

export interface PersonalLink {
  platform: string;
  url: string;
}

export interface BffEnvSource {
  SSR_API_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
  readonly [key: string]: string | undefined;
}

export interface BffUserPayload {
  user_id?: string | number | null;
  name?: string | null;
  avatar?: string | null;
  avatar_updated_at?: number | null;
  onboarding?: boolean;
  is_mentor?: boolean;
  job_title?: string | null;
  company?: string | null;
  experiences?: MentorExperience[] | null;
}

export interface NormalizeBffAuthUserInput {
  userId?: string | number | null;
  token: string;
  refreshToken?: string | null;
  email?: string | null;
  user: BffUserPayload;
}

function isPersonalLink(item: unknown): item is PersonalLink {
  if (typeof item !== 'object' || item === null) return false;
  const raw = item as Record<string, unknown>;
  return (
    typeof raw.url === 'string' &&
    typeof raw.platform === 'string' &&
    Boolean(raw.url) &&
    isSafeUrl(raw.url)
  );
}

/**
 * Resolves the canonical server-side BFF base URL, preferring container-internal
 * `SSR_API_URL` over public `NEXT_PUBLIC_API_URL`.
 */
export function resolveBffBaseUrl(env: BffEnvSource = process.env): string {
  return env.SSR_API_URL ?? env.NEXT_PUBLIC_API_URL ?? '';
}

export function resolveMentorExperienceLinks(
  experiences: MentorExperience[] | undefined | null
): PersonalLink[] {
  if (!experiences) return [];
  return experiences
    .filter((exp) => exp.category === 'LINK')
    .flatMap((exp) => {
      const list = exp.mentor_experiences_metadata?.data;
      return Array.isArray(list) ? list : [];
    })
    .filter(isPersonalLink);
}

/**
 * Normalizes BFF login / Google OAuth user payloads into the canonical NextAuth
 * JWT `User` shape shared across `credentials` and `custom-google-token`.
 */
export function normalizeBffAuthUser({
  userId,
  token,
  refreshToken,
  email,
  user,
}: NormalizeBffAuthUserInput): User {
  const resolvedId = userId ?? user.user_id;
  return {
    id: String(resolvedId ?? ''),
    token,
    refreshToken: refreshToken || undefined,
    email: email || undefined,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    avatarUpdatedAt: user.avatar_updated_at ?? undefined,
    onBoarding: user.onboarding,
    isMentor: user.is_mentor,
    jobTitle: user.job_title ?? '',
    company: user.company ?? '',
    personalLinks: resolveMentorExperienceLinks(user.experiences),
  };
}

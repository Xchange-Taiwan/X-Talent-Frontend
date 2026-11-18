import type { User } from 'next-auth';

import {
  decode,
  fromWireExperiences,
  type PersonalLink,
} from '@/lib/profile/experienceCodec';

export type { PersonalLink };

export interface MentorExperience {
  category: string;
  mentor_experiences_metadata?: {
    data?: unknown[];
  };
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

/**
 * Resolves the canonical BFF base URL, preferring container-internal
 * `SSR_API_URL` over public `NEXT_PUBLIC_API_URL`.
 *
 * Uses direct `process.env.NEXT_PUBLIC_API_URL` access when `env` is omitted so
 * Next.js / Turbopack client bundles statically inline the public BFF URL.
 */
export function resolveBffBaseUrl(env?: BffEnvSource): string {
  if (env !== undefined) {
    return env.SSR_API_URL ?? env.NEXT_PUBLIC_API_URL ?? '';
  }
  return process.env.SSR_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
}

export function resolveMentorExperienceLinks(
  experiences: readonly MentorExperience[] | undefined | null
): PersonalLink[] {
  if (!experiences) return [];
  return decode(fromWireExperiences(experiences), {
    preservePlatformCase: true,
  }).personalLinks;
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

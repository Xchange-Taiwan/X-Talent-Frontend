import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import type { PersonalLink } from '@/types/types';

export interface FlatIdentity {
  state?: 'unknown' | 'hint-only' | 'confirmed-guest' | 'confirmed-member';
  userId?: string;
  avatar?: string | null;
  isMentor?: boolean;
  name?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  personalLinks?: PersonalLink[];
}

/**
 * Builds a `ResolvedIdentity` for mocking `useResolvedIdentity` in tests - the
 * single call site every identity consumer (`useIdentity`, `Header`,
 * `useProfileAuth`, `useCurrentAvatar`, ...) now derives from. Defaults to
 * a fully-resolved guest so callers only need to override what the
 * scenario actually cares about.
 */
export function buildResolvedIdentity(
  overrides: FlatIdentity = {}
): ResolvedIdentity {
  const state =
    overrides.state ??
    (overrides.userId !== undefined ? 'confirmed-member' : 'confirmed-guest');

  switch (state) {
    case 'unknown':
      return {
        state: 'unknown',
        userId: undefined,
        avatar: undefined,
        isMentor: false,
      };
    case 'hint-only':
      return {
        state: 'hint-only',
        userId: undefined,
        avatar: overrides.avatar ?? undefined,
        isMentor: overrides.isMentor ?? false,
      };
    case 'confirmed-guest':
      return {
        state: 'confirmed-guest',
        userId: undefined,
        avatar: undefined,
        isMentor: false,
      };
    case 'confirmed-member': {
      const name = overrides.name ?? undefined;
      const jobTitle = overrides.jobTitle ?? undefined;
      const company = overrides.company ?? undefined;
      const personalLinks = overrides.personalLinks;
      return {
        state: 'confirmed-member',
        userId: overrides.userId ?? 'mock-user-id',
        avatar: overrides.avatar ?? undefined,
        isMentor: overrides.isMentor ?? false,
        ...(name !== undefined ? { name } : {}),
        ...(jobTitle !== undefined ? { jobTitle } : {}),
        ...(company !== undefined ? { company } : {}),
        ...(personalLinks !== undefined ? { personalLinks } : {}),
      };
    }
  }
}

/** Neither the session nor the cookie hint has resolved yet. */
export const UNKNOWN_IDENTITY: ResolvedIdentity = buildResolvedIdentity({
  state: 'unknown',
});

/** Confirmed not logged in. */
export const GUEST_IDENTITY: ResolvedIdentity = buildResolvedIdentity();

/** A fully-resolved, logged-in identity for the given userId. */
export function authenticatedIdentity(
  userId: string,
  overrides: FlatIdentity = {}
): ResolvedIdentity {
  return buildResolvedIdentity({
    state: 'confirmed-member',
    userId,
    ...overrides,
  });
}

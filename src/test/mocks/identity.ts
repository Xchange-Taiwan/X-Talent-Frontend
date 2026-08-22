import type { ResolvedIdentity } from '@/lib/auth/sessionHint';

export interface FlatIdentity {
  state?: 'unknown' | 'hint-only' | 'confirmed-guest' | 'confirmed-member';
  userId?: string;
  avatar?: string;
  isMentor?: boolean;
  isLoggedIn?: boolean;
  hasFullUser?: boolean;
  isResolvingUser?: boolean;
  authKnown?: boolean;
  sessionSettled?: boolean;
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
  const base = {
    authKnown: true,
    isLoggedIn: false,
    isMentor: false,
    userId: undefined,
    hasFullUser: false,
    isResolvingUser: false,
    avatar: undefined,
    sessionSettled: true,
    ...overrides,
  };

  let state: 'unknown' | 'hint-only' | 'confirmed-guest' | 'confirmed-member' =
    'confirmed-guest';
  if (!base.authKnown) {
    state = 'unknown';
  } else if (base.hasFullUser) {
    state = 'confirmed-member';
  } else if (!base.sessionSettled && base.isLoggedIn) {
    state = 'hint-only';
  }

  return {
    state,
    ...base,
  } as ResolvedIdentity;
}

/** Neither the session nor the cookie hint has resolved yet. */
export const UNKNOWN_IDENTITY: ResolvedIdentity = buildResolvedIdentity({
  authKnown: false,
  sessionSettled: false,
});

/** Confirmed not logged in. */
export const GUEST_IDENTITY: ResolvedIdentity = buildResolvedIdentity();

/** A fully-resolved, logged-in identity for the given userId. */
export function authenticatedIdentity(
  userId: string,
  overrides: FlatIdentity = {}
): ResolvedIdentity {
  return buildResolvedIdentity({
    isLoggedIn: true,
    hasFullUser: true,
    userId,
    ...overrides,
  });
}

import type { ResolvedIdentity } from '@/lib/auth/sessionHint';

/**
 * Builds a `ResolvedIdentity` for mocking `useSessionHint` in tests - the
 * single call site every identity consumer (`useIdentity`, `Header`,
 * `useProfileAuth`, `useCurrentAvatar`, ...) now derives from. Defaults to
 * a fully-resolved guest so callers only need to override what the
 * scenario actually cares about.
 */
export function buildResolvedIdentity(
  overrides: Partial<ResolvedIdentity> = {}
): ResolvedIdentity {
  return {
    authKnown: true,
    isLoggedIn: false,
    isMentor: false,
    userId: undefined,
    hasFullUser: false,
    isResolvingUser: false,
    avatar: undefined,
    ...overrides,
  };
}

/** Neither the session nor the cookie hint has resolved yet. */
export const UNKNOWN_IDENTITY: ResolvedIdentity = buildResolvedIdentity({
  authKnown: false,
});

/** Confirmed not logged in. */
export const GUEST_IDENTITY: ResolvedIdentity = buildResolvedIdentity();

/** A fully-resolved, logged-in identity for the given userId. */
export function authenticatedIdentity(
  userId: string,
  overrides: Partial<ResolvedIdentity> = {}
): ResolvedIdentity {
  return buildResolvedIdentity({
    isLoggedIn: true,
    hasFullUser: true,
    userId,
    ...overrides,
  });
}

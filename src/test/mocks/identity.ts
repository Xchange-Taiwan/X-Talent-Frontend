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

  // If isResolvingUser is true, then sessionSettled must be false in our state machine invariants
  if (base.isResolvingUser) {
    base.sessionSettled = false;
  }

  let state: 'unknown' | 'hint-only' | 'confirmed-guest' | 'confirmed-member' =
    'confirmed-guest';
  if (base.state) {
    state = base.state;
  } else if (!base.authKnown) {
    state = 'unknown';
  } else if (
    base.hasFullUser ||
    (base.isLoggedIn && base.sessionSettled) ||
    base.userId !== undefined
  ) {
    state = 'confirmed-member';
  } else if (
    base.isResolvingUser ||
    (base.isLoggedIn && !base.sessionSettled)
  ) {
    state = 'hint-only';
  }

  // Force align fields to be strictly compliant with the state's discriminated union definition
  switch (state) {
    case 'unknown':
      base.userId = undefined;
      base.avatar = undefined;
      base.isMentor = false;
      base.isLoggedIn = false;
      base.hasFullUser = false;
      base.isResolvingUser = false;
      base.authKnown = false;
      base.sessionSettled = false;
      break;
    case 'hint-only':
      base.userId = undefined;
      base.hasFullUser = false;
      base.isResolvingUser = true;
      base.isLoggedIn = true;
      base.authKnown = true;
      base.sessionSettled = false;
      break;
    case 'confirmed-guest':
      base.userId = undefined;
      base.avatar = undefined;
      base.isMentor = false;
      base.isLoggedIn = false;
      base.hasFullUser = false;
      base.isResolvingUser = false;
      base.authKnown = true;
      break;
    case 'confirmed-member':
      base.userId = base.userId ?? 'mock-user-id';
      base.isLoggedIn = true;
      base.hasFullUser = true;
      base.isResolvingUser = false;
      base.authKnown = true;
      base.sessionSettled = true;
      break;
  }

  return {
    ...base,
    state,
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

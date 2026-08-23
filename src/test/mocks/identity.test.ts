import { describe, expect, it } from 'vitest';

import {
  authenticatedIdentity,
  buildResolvedIdentity,
  GUEST_IDENTITY,
  UNKNOWN_IDENTITY,
} from './identity';

describe('buildResolvedIdentity', () => {
  it('should default to a confirmed guest identity when no overrides are provided', () => {
    const identity = buildResolvedIdentity();
    expect(identity.state).toBe('confirmed-guest');
    expect(identity.isLoggedIn).toBe(false);
    expect(identity.authKnown).toBe(true);
    expect(identity.userId).toBeUndefined();
    expect(identity.hasFullUser).toBe(false);
    expect(identity.isResolvingUser).toBe(false);
  });

  it('should align fields to unknown when state is overridden to unknown', () => {
    const identity = buildResolvedIdentity({ state: 'unknown' });
    expect(identity.state).toBe('unknown');
    expect(identity.authKnown).toBe(false);
    expect(identity.sessionSettled).toBe(false);
    expect(identity.isLoggedIn).toBe(false);
    expect(identity.userId).toBeUndefined();
    expect(identity.avatar).toBeUndefined();
    expect(identity.isMentor).toBe(false);
    expect(identity.hasFullUser).toBe(false);
    expect(identity.isResolvingUser).toBe(false);
  });

  it('should align fields to hint-only when state is overridden to hint-only', () => {
    const identity = buildResolvedIdentity({ state: 'hint-only' });
    expect(identity.state).toBe('hint-only');
    expect(identity.isLoggedIn).toBe(true);
    expect(identity.authKnown).toBe(true);
    expect(identity.sessionSettled).toBe(false);
    expect(identity.isResolvingUser).toBe(true);
    expect(identity.hasFullUser).toBe(false);
    expect(identity.userId).toBeUndefined();
  });

  it('should align fields to confirmed-member when state is overridden to confirmed-member', () => {
    const identity = buildResolvedIdentity({
      state: 'confirmed-member',
      userId: 'user-123',
    });
    expect(identity.state).toBe('confirmed-member');
    expect(identity.userId).toBe('user-123');
    expect(identity.isLoggedIn).toBe(true);
    expect(identity.hasFullUser).toBe(true);
    expect(identity.isResolvingUser).toBe(false);
    expect(identity.authKnown).toBe(true);
    expect(identity.sessionSettled).toBe(true);

    // Verify fallback userId when state is confirmed-member and no userId is provided
    const identityFallback = buildResolvedIdentity({
      state: 'confirmed-member',
    });
    expect(identityFallback.state).toBe('confirmed-member');
    expect(identityFallback.userId).toBe('mock-user-id');
  });

  it('should respect custom boolean properties and infer correct state when state is not explicitly overridden', () => {
    // When hasFullUser is true, state is inferred as confirmed-member
    const memberIdentity = buildResolvedIdentity({
      hasFullUser: true,
      userId: 'user-456',
    });
    expect(memberIdentity.state).toBe('confirmed-member');
    expect(memberIdentity.userId).toBe('user-456');

    // When authKnown is false, state is inferred as unknown
    const unknownIdentity = buildResolvedIdentity({
      authKnown: false,
    });
    expect(unknownIdentity.state).toBe('unknown');
    expect(unknownIdentity.authKnown).toBe(false);

    // When session is not settled and is logged in, state is inferred as hint-only
    const hintIdentity = buildResolvedIdentity({
      sessionSettled: false,
      isLoggedIn: true,
    });
    expect(hintIdentity.state).toBe('hint-only');
    expect(hintIdentity.isLoggedIn).toBe(true);

    // When isLoggedIn is true (without state or hasFullUser), state is inferred as confirmed-member (backward compatibility)
    const legacyMemberIdentity = buildResolvedIdentity({
      isLoggedIn: true,
    });
    expect(legacyMemberIdentity.state).toBe('confirmed-member');
    expect(legacyMemberIdentity.isLoggedIn).toBe(true);
    expect(legacyMemberIdentity.hasFullUser).toBe(true);

    // When isResolvingUser is true (without state), state is inferred as hint-only (backward compatibility)
    const legacyResolvingIdentity = buildResolvedIdentity({
      isResolvingUser: true,
    });
    expect(legacyResolvingIdentity.state).toBe('hint-only');
    expect(legacyResolvingIdentity.isResolvingUser).toBe(true);
    expect(legacyResolvingIdentity.isLoggedIn).toBe(true);
    expect(legacyResolvingIdentity.sessionSettled).toBe(false);

    // When userId is provided (without state or hasFullUser), state is inferred as confirmed-member (backward compatibility)
    const legacyUserIdIdentity = buildResolvedIdentity({
      userId: 'user-999',
    });
    expect(legacyUserIdIdentity.state).toBe('confirmed-member');
    expect(legacyUserIdIdentity.userId).toBe('user-999');
    expect(legacyUserIdIdentity.isLoggedIn).toBe(true);
    expect(legacyUserIdIdentity.hasFullUser).toBe(true);
  });

  it('should verify export constants are defined correctly', () => {
    expect(UNKNOWN_IDENTITY.state).toBe('unknown');
    expect(UNKNOWN_IDENTITY.authKnown).toBe(false);

    expect(GUEST_IDENTITY.state).toBe('confirmed-guest');
    expect(GUEST_IDENTITY.authKnown).toBe(true);

    const authId = authenticatedIdentity('user-789');
    expect(authId.state).toBe('confirmed-member');
    expect(authId.userId).toBe('user-789');
  });
});

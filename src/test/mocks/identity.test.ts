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
    expect(identity.userId).toBeUndefined();
    expect(identity.avatar).toBeUndefined();
    expect(identity.isMentor).toBe(false);
  });

  it('should align fields to unknown when state is overridden to unknown', () => {
    const identity = buildResolvedIdentity({ state: 'unknown' });
    expect(identity.state).toBe('unknown');
    expect(identity.userId).toBeUndefined();
    expect(identity.avatar).toBeUndefined();
    expect(identity.isMentor).toBe(false);
  });

  it('should align fields to hint-only when state is overridden to hint-only', () => {
    const identity = buildResolvedIdentity({
      state: 'hint-only',
      avatar: 'https://avatar.png',
      isMentor: true,
    });
    expect(identity.state).toBe('hint-only');
    expect(identity.userId).toBeUndefined();
    expect(identity.avatar).toBe('https://avatar.png');
    expect(identity.isMentor).toBe(true);
  });

  it('should align fields to confirmed-member when state is overridden to confirmed-member', () => {
    const identity = buildResolvedIdentity({
      state: 'confirmed-member',
      userId: 'user-123',
    });
    expect(identity.state).toBe('confirmed-member');
    expect(identity.userId).toBe('user-123');

    // Verify fallback userId when state is confirmed-member and no userId is provided
    const identityFallback = buildResolvedIdentity({
      state: 'confirmed-member',
    });
    expect(identityFallback.state).toBe('confirmed-member');
    expect(identityFallback.userId).toBe('mock-user-id');
  });

  it('should verify export constants are defined correctly', () => {
    expect(UNKNOWN_IDENTITY.state).toBe('unknown');
    expect(GUEST_IDENTITY.state).toBe('confirmed-guest');

    const authId = authenticatedIdentity('user-789');
    expect(authId.state).toBe('confirmed-member');
    expect(authId.userId).toBe('user-789');
  });
});

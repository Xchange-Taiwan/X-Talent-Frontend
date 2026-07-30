import { describe, expect, it } from 'vitest';
import { resolveMockSession, defaultMockSession } from './withAppContext';
import type { Session } from 'next-auth';

describe('resolveMockSession', () => {
  it('should return defaultMockSession and status authenticated when no args are provided', () => {
    const result = resolveMockSession({});
    expect(result).toEqual({
      session: defaultMockSession,
      status: 'authenticated',
    });
  });

  it('should return defaultMockSession and status authenticated when args is undefined', () => {
    const result = resolveMockSession(undefined);
    expect(result).toEqual({
      session: defaultMockSession,
      status: 'authenticated',
    });
  });

  it('should prioritize and return the session arg and status when provided', () => {
    const customSession: Session = {
      user: {
        id: 'custom-id',
        email: 'custom@example.com',
        name: 'Custom User',
        onBoarding: false,
        isMentor: true,
      },
      accessToken: 'custom-token',
      expires: '2026-12-31T23:59:59.000Z',
    };

    const result = resolveMockSession(undefined, { session: customSession });
    expect(result).toEqual({
      session: customSession,
      status: 'authenticated',
    });
  });

  it('should return null session and unauthenticated status if the session arg is null', () => {
    const result = resolveMockSession(undefined, { session: null });
    expect(result).toEqual({
      session: null,
      status: 'unauthenticated',
    });
  });

  it('should merge user fields with defaultMockSession when user arg is provided', () => {
    const partialUser = {
      name: 'Jane Doe',
      isMentor: true,
    };

    const result = resolveMockSession(undefined, { user: partialUser });
    expect(result).toEqual({
      session: {
        ...defaultMockSession,
        user: {
          ...defaultMockSession.user,
          name: 'Jane Doe',
          isMentor: true,
        },
      },
      status: 'authenticated',
    });
  });

  it('should resolve session correctly from parameters configuration object', () => {
    const nextAuthParams = {
      user: { name: 'Parameter User', isMentor: true },
    };
    const result = resolveMockSession(nextAuthParams);
    expect(result).toEqual({
      session: {
        ...defaultMockSession,
        user: {
          ...defaultMockSession.user,
          name: 'Parameter User',
          isMentor: true,
        },
      },
      status: 'authenticated',
    });
  });

  it('should return null session and unauthenticated status if the user arg is null and session is not provided', () => {
    const result = resolveMockSession(undefined, { user: null });
    expect(result).toEqual({
      session: null,
      status: 'unauthenticated',
    });
  });

  it('should prioritize session over user when both are provided', () => {
    const customSession: Session = {
      user: {
        id: 'custom-id',
        email: 'custom@example.com',
        name: 'Session User',
        onBoarding: false,
        isMentor: true,
      },
      accessToken: 'custom-token',
      expires: '2026-12-31T23:59:59.000Z',
    };

    const result = resolveMockSession(undefined, {
      session: customSession,
      user: { name: 'User Arg' },
    });
    expect(result).toEqual({
      session: customSession,
      status: 'authenticated',
    });
  });

  it('should resolve session and status from parameters.auth nested structure', () => {
    const customSession: Session = {
      user: {
        id: 'auth-param-id',
        email: 'auth@example.com',
        name: 'Auth Param User',
        onBoarding: true,
        isMentor: false,
      },
      accessToken: 'auth-token',
      expires: '2099-01-01T00:00:00.000Z',
    };

    const params = {
      auth: {
        session: customSession,
        status: 'authenticated' as const,
      },
    };

    const result = resolveMockSession(params);
    expect(result).toEqual({
      session: customSession,
      status: 'authenticated',
    });
  });

  it('should support loading status from parameters.auth', () => {
    const params = {
      auth: {
        session: null,
        status: 'loading' as const,
      },
    };

    const result = resolveMockSession(params);
    expect(result).toEqual({
      session: null,
      status: 'loading',
    });
  });
});

import { signIn } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { googleCallback } from '@/lib/actions/googleCallback';
import type { components } from '@/types/api';

import {
  clearPendingDeleteAccountEmail,
  getPendingDeleteAccountEmail,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from './oauthOutcome';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type ProfileVO = components['schemas']['ProfileVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

vi.mock('@/lib/actions/googleCallback', () => ({
  googleCallback: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

const mockGoogleCallback = vi.mocked(googleCallback);
const mockSignIn = vi.mocked(signIn);

describe('getPendingDeleteAccountEmail & clearPendingDeleteAccountEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub sessionStorage in JSDOM
    const store: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      },
    });
  });

  it('returns null if window/sessionStorage is not found or empty', () => {
    sessionStorage.clear();
    const result = getPendingDeleteAccountEmail();
    expect(result).toBeNull();
  });

  it('retrieves the email but does not remove it from sessionStorage', () => {
    sessionStorage.setItem('delete_account_email', 'user@example.com');

    const result = getPendingDeleteAccountEmail();

    expect(result).toBe('user@example.com');
    expect(sessionStorage.getItem('delete_account_email')).toBe(
      'user@example.com'
    );
  });

  it('removes the email when clearPendingDeleteAccountEmail is called', () => {
    sessionStorage.setItem('delete_account_email', 'user@example.com');

    clearPendingDeleteAccountEmail();

    expect(sessionStorage.getItem('delete_account_email')).toBeNull();
  });
});

describe('signInWithGoogleToken', () => {
  it('calls next-auth signIn with correct custom-google-token options', async () => {
    mockSignIn.mockResolvedValue({
      error: undefined,
      ok: true,
    } as unknown as Awaited<ReturnType<typeof signIn>>);

    await signInWithGoogleToken('token123', 'user@example.com', {
      id: 'user-1',
    });

    expect(mockSignIn).toHaveBeenCalledWith('custom-google-token', {
      redirect: false,
      token: 'token123',
      email: 'user@example.com',
      user: '{"id":"user-1"}',
    });
  });

  it('throws an error if NextAuth signIn returns an error', async () => {
    mockSignIn.mockResolvedValue({
      error: 'OAuthSigninError',
      ok: false,
    } as unknown as Awaited<ReturnType<typeof signIn>>);

    await expect(
      signInWithGoogleToken('token123', 'user@example.com', { id: 'user-1' })
    ).rejects.toThrow('OAuthSigninError');
  });
});

describe('resolveOAuthOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns INVALID if code or state is missing', async () => {
    const res1 = await resolveOAuthOutcome(null, 'state');
    expect(res1).toEqual({ type: 'INVALID', errorType: 'MISSING_PARAMS' });

    const res2 = await resolveOAuthOutcome('code', null);
    expect(res2).toEqual({ type: 'INVALID', errorType: 'MISSING_PARAMS' });
  });

  it('returns INVALID if googleCallback fails or returns no data', async () => {
    mockGoogleCallback.mockResolvedValue({
      code: '1',
    } as unknown as OAuthCallbackResponse);

    const res = await resolveOAuthOutcome('code', 'state');
    expect(res).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });
  });

  it('returns INVALID if googleCallback throws', async () => {
    mockGoogleCallback.mockRejectedValue(new Error('Network error'));

    const res = await resolveOAuthOutcome('code', 'state');
    expect(res).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });
  });

  describe('with pending delete account email flow', () => {
    it('returns RESUME_DELETE_ACCOUNT if auth_type is LOGIN', async () => {
      const mockData: GoogleCallbackVO = {
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: { user_id: 123 } as unknown as ProfileVO,
      };
      mockGoogleCallback.mockResolvedValue({
        data: mockData,
      } as unknown as OAuthCallbackResponse);

      const res = await resolveOAuthOutcome('code', 'state', {
        pendingDeleteAccountEmail: 'delete@example.com',
      });

      expect(res).toEqual({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockData,
        email: 'delete@example.com',
      });
    });

    it('returns INVALID with DELETE_FLOW_INVALID error if auth_type is SIGNUP', async () => {
      const mockData: GoogleCallbackVO = {
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      };
      mockGoogleCallback.mockResolvedValue({
        data: mockData,
      } as unknown as OAuthCallbackResponse);

      const res = await resolveOAuthOutcome('code', 'state', {
        pendingDeleteAccountEmail: 'delete@example.com',
      });

      expect(res).toEqual({
        type: 'INVALID',
        errorType: 'DELETE_FLOW_INVALID',
      });
    });
  });

  describe('standard oauth flow (no delete email)', () => {
    it('returns SIGNUP if auth_type is SIGNUP', async () => {
      const mockData: GoogleCallbackVO = {
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      };
      mockGoogleCallback.mockResolvedValue({
        data: mockData,
      } as unknown as OAuthCallbackResponse);

      const res = await resolveOAuthOutcome('code', 'state');

      expect(res).toEqual({
        type: 'SIGNUP',
        data: mockData,
      });
    });

    it('returns LOGIN if auth_type is LOGIN', async () => {
      const mockData: GoogleCallbackVO = {
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: { user_id: 123 } as unknown as ProfileVO,
      };
      mockGoogleCallback.mockResolvedValue({
        data: mockData,
      } as unknown as OAuthCallbackResponse);

      const res = await resolveOAuthOutcome('code', 'state');

      expect(res).toEqual({
        type: 'LOGIN',
        data: mockData,
      });
    });
  });
});

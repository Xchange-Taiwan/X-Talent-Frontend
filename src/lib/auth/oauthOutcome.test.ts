import { signIn } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { googleCallback } from '@/lib/actions/googleCallback';

import {
  consumePendingDeleteAccountEmail,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from './oauthOutcome';

vi.mock('@/lib/actions/googleCallback', () => ({
  googleCallback: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

const mockGoogleCallback = vi.mocked(googleCallback);
const mockSignIn = vi.mocked(signIn);

describe('consumePendingDeleteAccountEmail', () => {
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
    const result = consumePendingDeleteAccountEmail();
    expect(result).toBeNull();
  });

  it('retrieves the email and immediately removes it from sessionStorage', () => {
    sessionStorage.setItem('delete_account_email', 'user@example.com');

    const result = consumePendingDeleteAccountEmail();

    expect(result).toBe('user@example.com');
    expect(sessionStorage.getItem('delete_account_email')).toBeNull();
  });
});

describe('signInWithGoogleToken', () => {
  it('calls next-auth signIn with correct custom-google-token options', async () => {
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
    mockGoogleCallback.mockResolvedValue({ code: '1' } as any); // no data property

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
      const mockData = {
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: { id: 'u_1' },
      };
      mockGoogleCallback.mockResolvedValue({ data: mockData } as any);

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
      const mockData = {
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      };
      mockGoogleCallback.mockResolvedValue({ data: mockData } as any);

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
      const mockData = {
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      };
      mockGoogleCallback.mockResolvedValue({ data: mockData } as any);

      const res = await resolveOAuthOutcome('code', 'state');

      expect(res).toEqual({
        type: 'SIGNUP',
        data: mockData,
      });
    });

    it('returns LOGIN if auth_type is LOGIN', async () => {
      const mockData = {
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: { id: 'u_1' },
      };
      mockGoogleCallback.mockResolvedValue({ data: mockData } as any);

      const res = await resolveOAuthOutcome('code', 'state');

      expect(res).toEqual({
        type: 'LOGIN',
        data: mockData,
      });
    });
  });
});

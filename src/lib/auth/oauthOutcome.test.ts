import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInMemorySessionStorage } from '@/lib/auth/authFlowStorage';
import type { components } from '@/types/api';

import {
  clearPendingDeleteAccountEmail,
  type ClientSignInFn,
  getPendingDeleteAccountEmail,
  type GoogleOAuthCodeExchanger,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from './oauthOutcome';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type ProfileVO = components['schemas']['ProfileVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

describe('getPendingDeleteAccountEmail & clearPendingDeleteAccountEmail', () => {
  it('returns null when storage is empty', () => {
    const storage = createInMemorySessionStorage();
    expect(getPendingDeleteAccountEmail(storage)).toBeNull();
  });

  it('retrieves the email without removing it from storage', () => {
    const storage = createInMemorySessionStorage({
      delete_account_email: 'user@example.com',
    });

    expect(getPendingDeleteAccountEmail(storage)).toBe('user@example.com');
    expect(storage.getItem('delete_account_email')).toBe('user@example.com');
  });

  it('removes the email when clearPendingDeleteAccountEmail is called', () => {
    const storage = createInMemorySessionStorage({
      delete_account_email: 'user@example.com',
    });

    clearPendingDeleteAccountEmail(storage);

    expect(storage.getItem('delete_account_email')).toBeNull();
  });
});

describe('signInWithGoogleToken', () => {
  it('calls injected signIn adapter with custom-google-token options', async () => {
    const mockSignIn = vi.fn<ClientSignInFn>().mockResolvedValue({
      error: undefined,
      ok: true,
    });

    await signInWithGoogleToken(mockSignIn, 'token123', 'user@example.com', {
      id: 'user-1',
    });

    expect(mockSignIn).toHaveBeenCalledWith('custom-google-token', {
      redirect: false,
      token: 'token123',
      email: 'user@example.com',
      user: '{"id":"user-1"}',
    });
  });

  it('throws an error if injected signIn adapter returns an error', async () => {
    const mockSignIn = vi.fn<ClientSignInFn>().mockResolvedValue({
      error: 'OAuthSigninError',
      ok: false,
    });

    await expect(
      signInWithGoogleToken(mockSignIn, 'token123', 'user@example.com', {
        id: 'user-1',
      })
    ).rejects.toThrow('OAuthSigninError');
  });
});

describe('resolveOAuthOutcome', () => {
  const mockExchangeCode = vi.fn<GoogleOAuthCodeExchanger>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns INVALID if code or state is missing without calling exchangeCode', async () => {
    const res1 = await resolveOAuthOutcome(null, 'state', {
      exchangeCode: mockExchangeCode,
    });
    expect(res1).toEqual({ type: 'INVALID', errorType: 'MISSING_PARAMS' });

    const res2 = await resolveOAuthOutcome('code', null, {
      exchangeCode: mockExchangeCode,
    });
    expect(res2).toEqual({ type: 'INVALID', errorType: 'MISSING_PARAMS' });
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  it('returns INVALID if exchangeCode returns no data', async () => {
    mockExchangeCode.mockResolvedValue(
      fromPartial<OAuthCallbackResponse>({
        code: '1',
      })
    );

    const res = await resolveOAuthOutcome('code', 'state', {
      exchangeCode: mockExchangeCode,
    });
    expect(res).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });
  });

  it('returns INVALID if exchangeCode throws', async () => {
    mockExchangeCode.mockRejectedValue(new Error('Network error'));

    const res = await resolveOAuthOutcome('code', 'state', {
      exchangeCode: mockExchangeCode,
    });
    expect(res).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });
  });

  describe('with pending delete account email flow', () => {
    it('returns RESUME_DELETE_ACCOUNT if auth_type is LOGIN', async () => {
      const mockData = fromPartial<GoogleCallbackVO>({
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: fromPartial<ProfileVO>({ user_id: 123 }),
      });
      mockExchangeCode.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: mockData,
        })
      );

      const res = await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
        pendingDeleteAccountEmail: 'delete@example.com',
      });

      expect(res).toEqual({
        type: 'RESUME_DELETE_ACCOUNT',
        data: mockData,
        email: 'delete@example.com',
      });
    });

    it('returns INVALID with DELETE_FLOW_INVALID error if auth_type is SIGNUP', async () => {
      const mockData = fromPartial<GoogleCallbackVO>({
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      });
      mockExchangeCode.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: mockData,
        })
      );

      const res = await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
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
      const mockData = fromPartial<GoogleCallbackVO>({
        auth_type: 'SIGNUP',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: null,
      });
      mockExchangeCode.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: mockData,
        })
      );

      const res = await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      });

      expect(res).toEqual({
        type: 'SIGNUP',
        data: mockData,
      });
    });

    it('returns LOGIN if auth_type is LOGIN', async () => {
      const mockData = fromPartial<GoogleCallbackVO>({
        auth_type: 'LOGIN',
        auth: { token: 'tok_123', email: 'user@example.com' },
        user: fromPartial<ProfileVO>({ user_id: 123 }),
      });
      mockExchangeCode.mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: mockData,
        })
      );

      const res = await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      });

      expect(res).toEqual({
        type: 'LOGIN',
        data: mockData,
      });
    });
  });
});

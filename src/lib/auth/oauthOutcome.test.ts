import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { components } from '@/types/api';

import {
  clampOnboardingName,
  type ClientSignInFn,
  enrichGoogleLoginUserWithIdTokenFallback,
  extractGoogleIdTokenProfileFallback,
  type GoogleOAuthCodeExchanger,
  normalizeGoogleAvatarUrl,
  resolveOAuthOutcome,
  sanitizePrefillAvatarUrl,
  signInWithGoogleToken,
} from './oauthOutcome';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type ProfileVO = components['schemas']['ProfileVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

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

function buildTestJwt(payload: Record<string, unknown>): string {
  const encodePart = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  return `${encodePart({ alg: 'RS256', typ: 'JWT' })}.${encodePart(payload)}.sig`;
}

describe('Google OAuth id_token fallback & =s512-c avatar normalization (#951)', () => {
  it('upgrades standard, monogram FIFE, and unsuffixed lh3.googleusercontent.com URLs to =s512-c while rejecting ports, credentials, root paths, and non-HTTPS hosts', () => {
    expect(
      normalizeGoogleAvatarUrl(
        'https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s96-c'
      )
    ).toBe('https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s512-c');

    expect(
      normalizeGoogleAvatarUrl(
        'https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s96-c-mo'
      )
    ).toBe('https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s512-c');

    expect(
      normalizeGoogleAvatarUrl(
        'https://lh3.googleusercontent.com/a/ACg8ocJ_unsuffixed'
      )
    ).toBe('https://lh3.googleusercontent.com/a/ACg8ocJ_unsuffixed=s512-c');

    expect(
      normalizeGoogleAvatarUrl('https://lh3.googleusercontent.com/')
    ).toBeUndefined();

    expect(
      normalizeGoogleAvatarUrl(
        'https://lh3.googleusercontent.com:8443/a/ACg8ocJ_test123=s96-c'
      )
    ).toBeUndefined();

    expect(
      normalizeGoogleAvatarUrl(
        'https://user:pass@lh3.googleusercontent.com/a/ACg8ocJ_test123=s96-c'
      )
    ).toBeUndefined();

    expect(
      normalizeGoogleAvatarUrl(
        'http://lh3.googleusercontent.com/a/ACg8ocJ_test123=s96-c'
      )
    ).toBeUndefined();

    expect(
      normalizeGoogleAvatarUrl('https://evil.example.com/a/avatar=s96-c')
    ).toBeUndefined();

    expect(
      sanitizePrefillAvatarUrl(
        'http://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/a.png'
      )
    ).toBeUndefined();

    expect(
      sanitizePrefillAvatarUrl(
        'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com:8443/avatars/1/a.png'
      )
    ).toBeUndefined();

    expect(
      sanitizePrefillAvatarUrl(
        'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com///'
      )
    ).toBeUndefined();

    expect(
      sanitizePrefillAvatarUrl('https://unconfigured-cdn.example.com/a.png')
    ).toBeUndefined();

    expect(
      sanitizePrefillAvatarUrl(
        'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/a.png'
      )
    ).toBe(
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/a.png'
    );
  });

  it('decodes UTF-8 CJK/surrogate names clamped to 20 code units, falls back to given_name/family_name, and rejects malformed JWT payloads', () => {
    const idToken = buildTestJwt({
      sub: 'google-sub-1',
      email: 'chen@example.com',
      name: '  陳渝軒 Bonny  ',
      picture: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s96-c',
    });

    expect(extractGoogleIdTokenProfileFallback(idToken)).toEqual({
      name: '陳渝軒 Bonny',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s512-c',
    });

    // Long name > 20 code units + surrogate pair at boundary is safely clamped without lone surrogates
    expect(clampOnboardingName('Christopher Montgomery')).toBe(
      'Christopher Montgome'
    );
    expect(clampOnboardingName('1234567890123456789😀extra')).toBe(
      '1234567890123456789'
    );

    // Fallback to given_name + family_name when name claim is absent
    const splitNameToken = buildTestJwt({
      given_name: 'Jack',
      family_name: 'Lee',
      picture: 'https://lh3.googleusercontent.com/a/ACg8ocJack',
    });
    expect(extractGoogleIdTokenProfileFallback(splitNameToken)).toEqual({
      name: 'Jack Lee',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s512-c',
    });

    // Rejects invalid base64url, invalid UTF-8 bytes, JSON arrays/primitives
    expect(extractGoogleIdTokenProfileFallback('not-a-jwt')).toEqual({});
    expect(extractGoogleIdTokenProfileFallback('a.!!!invalid!!!.c')).toEqual(
      {}
    );
    expect(extractGoogleIdTokenProfileFallback('a.____.c')).toEqual({});
    // Invalid UTF-8 byte sequence (0xff) inside an otherwise syntactically valid JSON string {"name":"<0xff>"}
    const invalidUtf8InJson = Buffer.from([
      0x7b, 0x22, 0x6e, 0x61, 0x6d, 0x65, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]).toString('base64url');
    expect(
      extractGoogleIdTokenProfileFallback(
        `eyJhbGciOiJSUzI1NiJ9.${invalidUtf8InJson}.sig`
      )
    ).toEqual({});
    const arrayJwt = `eyJhbGciOiJSUzI1NiJ9.${Buffer.from('[1,2,3]', 'utf8').toString('base64url')}.sig`;
    expect(extractGoogleIdTokenProfileFallback(arrayJwt)).toEqual({});
    expect(extractGoogleIdTokenProfileFallback(null)).toEqual({});
  });

  it('fills missing name and =s512-c avatar only for pre-onboarding users without clobbering existing profile fields', () => {
    const idToken = buildTestJwt({
      name: '李杰克',
      picture: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s96-c',
    });

    // 1. Pre-onboarding user before SQS outbox lands ({ user_id, onboarding: false })
    expect(
      enrichGoogleLoginUserWithIdTokenFallback(
        { user_id: 101, onboarding: false },
        idToken
      )
    ).toEqual({
      user_id: 101,
      onboarding: false,
      name: '李杰克',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s512-c',
    });

    // 2. Pre-onboarding user with custom S3 avatar keeps custom S3 avatar
    expect(
      enrichGoogleLoginUserWithIdTokenFallback(
        {
          user_id: 102,
          onboarding: false,
          name: 'Custom Name',
          avatar:
            'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/102/a.png',
        },
        idToken
      )
    ).toEqual({
      user_id: 102,
      onboarding: false,
      name: 'Custom Name',
      avatar:
        'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/102/a.png',
    });

    // 3. Already-onboarded user who intentionally cleared avatar is NOT overwritten
    expect(
      enrichGoogleLoginUserWithIdTokenFallback(
        { user_id: 103, onboarding: true, name: 'Existing Member', avatar: '' },
        idToken
      )
    ).toEqual({
      user_id: 103,
      onboarding: true,
      name: 'Existing Member',
      avatar: '',
    });
  });
});

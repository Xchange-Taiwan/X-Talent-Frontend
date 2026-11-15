import { fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import type { Session } from 'next-auth';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, setSessionGetter } from '@/lib/apiClient';
import { authClient } from '@/services/auth/authClient';

vi.mock('@/lib/monitoring', () => ({
  captureApiFailure: vi.fn(),
}));

describe('authClient behavioral seam (#895)', () => {
  const mockFetch = vi.fn();
  const mockGetSession = vi.fn<() => Promise<Session | null>>();
  const originalCanDelete = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;
  const originalSsrUrl = process.env.SSR_API_URL;
  const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockGetSession.mockResolvedValue(
      fromPartial<Session>({
        accessToken: 'active-jwt-token',
        expires: '2099-01-01T00:00:00.000Z',
        user: { id: '42' },
      })
    );
    setSessionGetter(mockGetSession);
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
    process.env.SSR_API_URL = 'https://bff.example.com/api';
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalCanDelete === undefined) {
      delete process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;
    } else {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalCanDelete;
    }
    if (originalSsrUrl === undefined) {
      delete process.env.SSR_API_URL;
    } else {
      process.env.SSR_API_URL = originalSsrUrl;
    }
    if (originalPublicUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublicUrl;
    }
  });

  it('maintains deep module boundaries with zero React, Next, or hook imports', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'authClient.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/from\s+['"]next\//);
    expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
    expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
  });

  describe('signUp', () => {
    it('posts unauthenticated signup payload and resolves on code === "0"', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
          status: 200,
        })
      );

      await expect(
        authClient.signUp({
          email: 'new@example.com',
          password: 'Password1!',
          confirm_password: 'Password1!',
        })
      ).resolves.toBeUndefined();

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://bff.example.com/api/v1/auth/signup');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBeUndefined();
      expect(JSON.parse(init.body)).toEqual({
        email: 'new@example.com',
        password: 'Password1!',
        confirm_password: 'Password1!',
      });
    });

    it('preserves ApiError metadata on HTTP-200 non-zero BFF envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '406',
            msg: '此電子郵件已被註冊',
            data: { field: 'email' },
          }),
          { status: 200 }
        )
      );

      await expect(
        authClient.signUp({
          email: 'dup@example.com',
          password: 'Password1!',
          confirm_password: 'Password1!',
        })
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 406,
        code: '406',
        message: '此電子郵件已被註冊',
        data: { field: 'email' },
      });
    });
  });

  describe('confirmSignUp & resendVerificationEmail', () => {
    it('rejects HTTP-200 non-zero BFF envelope on confirmSignUp with ApiError instead of false-positive success', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '400',
            msg: '驗證連結已失效',
            data: null,
          }),
          { status: 200 }
        )
      );

      let caught: unknown;
      try {
        await authClient.confirmSignUp('expired-token');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect(caught).toMatchObject({
        status: 400,
        code: '400',
        message: '驗證連結已失效',
      });
    });

    it('resolves confirmSignUp and resendVerificationEmail when BFF envelope code === "0"', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
            status: 200,
          })
        );

      await expect(
        authClient.confirmSignUp('valid-token')
      ).resolves.toBeUndefined();
      await expect(
        authClient.resendVerificationEmail('verify@example.com')
      ).resolves.toBeUndefined();

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://bff.example.com/api/v1/auth/signup/confirm'
      );
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
        token: 'valid-token',
      });

      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://bff.example.com/api/v1/auth/email/resend'
      );
      expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
        email: 'verify@example.com',
      });
    });

    it('preserves ApiError on resendVerificationEmail HTTP-200 non-zero envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '429',
            msg: '請求過於頻繁，請稍後再試',
            data: null,
          }),
          { status: 200 }
        )
      );

      await expect(
        authClient.resendVerificationEmail('verify@example.com')
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 429,
        code: '429',
        message: '請求過於頻繁，請稍後再試',
      });
    });
  });

  describe('requestPasswordResetEmail & resetPasswordWithToken', () => {
    it('sends query param email for requestPasswordResetEmail and preserves ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
          status: 200,
        })
      );

      await authClient.requestPasswordResetEmail('forgot@example.com');
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://bff.example.com/api/v1/auth/password/reset/email?email=forgot%40example.com'
      );
      expect(mockFetch.mock.calls[0][1].method).toBe('GET');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: '404', msg: '查無此信箱', data: null }),
          { status: 200 }
        )
      );

      await expect(
        authClient.requestPasswordResetEmail('missing@example.com')
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        message: '查無此信箱',
      });
    });

    it('sends PUT body and verify_token query param for resetPasswordWithToken', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
          status: 200,
        })
      );

      await authClient.resetPasswordWithToken({
        verifyToken: 'tok-99',
        password: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://bff.example.com/api/v1/auth/password/reset?verify_token=tok-99'
      );
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({
        password: 'NewPassword1!',
        confirm_password: 'NewPassword1!',
      });
    });
  });

  describe('getGoogleAuthorizeUrl', () => {
    it('routes login and signup intents to their respective v2 OAuth endpoints', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                authorization_url: 'https://accounts.google.com/o/login',
                state: 'st-login',
              },
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: '0',
              msg: 'ok',
              data: {
                authorization_url: 'https://accounts.google.com/o/signup',
                state: 'st-signup',
              },
            }),
            { status: 200 }
          )
        );

      const loginData = await authClient.getGoogleAuthorizeUrl('login');
      const signupData = await authClient.getGoogleAuthorizeUrl('signup');

      expect(loginData.authorization_url).toBe(
        'https://accounts.google.com/o/login'
      );
      expect(signupData.authorization_url).toBe(
        'https://accounts.google.com/o/signup'
      );
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://bff.example.com/api/v2/oauth/google/authorize/login'
      );
      expect(mockFetch.mock.calls[1][0]).toBe(
        'https://bff.example.com/api/v2/oauth/google/authorize/signup'
      );
    });

    it('rejects HTTP-200 non-zero BFF envelope and missing authorization_url with ApiError', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '500',
            msg: 'OAuth provider unavailable',
            data: null,
          }),
          { status: 200 }
        )
      );

      await expect(
        authClient.getGoogleAuthorizeUrl('login')
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
        message: 'OAuth provider unavailable',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '0',
            msg: 'ok',
            data: { authorization_url: '' },
          }),
          { status: 200 }
        )
      );

      await expect(
        authClient.getGoogleAuthorizeUrl('signup')
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 502,
        message: '無法取得 Google 授權連結',
      });
    });
  });

  describe('deleteAccount', () => {
    it('blocks deletion when NEXT_PUBLIC_CAN_DELETE_ACCOUNT is not "true"', async () => {
      process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';

      const result = await authClient.deleteAccount(
        fromPartial({ email: 'user@example.com', password: 'Password1!' })
      );

      expect(result).toEqual({
        status: 'error',
        message: '此環境不支援帳號刪除',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('enforces unwrapped envelope check so HTTP-200 non-zero responses do not falsely report success', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '400',
            msg: '密碼錯誤',
            data: null,
          }),
          { status: 200 }
        )
      );

      const errorResult = await authClient.deleteAccount(
        fromPartial({ email: 'user@example.com', password: 'WrongPassword1!' })
      );
      expect(errorResult).toEqual({
        status: 'error',
        message: '密碼錯誤',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: '409',
            msg: '尚有進行中預約',
            data: null,
          }),
          { status: 200 }
        )
      );

      const blockedResult = await authClient.deleteAccount(
        fromPartial({ email: 'user@example.com', password: 'Password1!' })
      );
      expect(blockedResult).toEqual({ status: 'blocked_reservations' });

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: '0', msg: 'ok', data: null }), {
          status: 200,
        })
      );

      const okResult = await authClient.deleteAccount(
        fromPartial({ email: 'user@example.com', password: 'Password1!' })
      );
      expect(okResult).toEqual({ status: 'success' });
      expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe(
        'Bearer active-jwt-token'
      );
    });
  });

  describe('postBackendLogout', () => {
    it('posts to local /api/auth/backend-logout without prefixing BFF base URL and attaches AbortSignal.timeout', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await authClient.postBackendLogout();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/auth/backend-logout');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBeUndefined();
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });
});

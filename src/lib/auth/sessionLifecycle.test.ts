import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import type { Session } from 'next-auth';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_FLOW_STORAGE_KEYS,
  clearAuthFlowStorage,
  clearPendingCallbackUrl,
  clearPendingDeleteAccountEmail,
  clearPendingPasswordResetEmail,
  clearPendingVerificationEmail,
  consumePendingCallbackUrl,
  createInMemorySessionStorage,
  getPendingDeleteAccountEmail,
  getPendingPasswordResetEmail,
  getPendingVerificationEmail,
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
  PENDING_PASSWORD_RESET_EMAIL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
  persistPendingCallbackUrlFromSearch,
  setPendingDeleteAccountEmail,
  setPendingPasswordResetEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/authFlowStorage';
import {
  normalizeBffAuthUser,
  resolveBffBaseUrl,
  resolveMentorExperienceLinks,
} from '@/lib/auth/bffAuth';
import {
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';
import {
  executeDeleteAccountXC,
  executeGoogleOAuthCallback,
  initiateGoogleDeleteAccountReauth,
  type SessionTeardownReason,
  SignInLifecycleError,
  signInWithCredentials,
  terminateClientSession,
} from '@/lib/auth/sessionLifecycle';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { notificationStoreManager } from '@/stores/notificationStore';
import type { components } from '@/types/api';
import type { Reservation } from '@/types/reservation';

type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];
type ProfileVO = components['schemas']['ProfileVO'];

describe('auth deep modules boundary (#885)', () => {
  it.each([
    'authFlowStorage.ts',
    'bffAuth.ts',
    'oauthOutcome.ts',
    'sessionLifecycle.ts',
  ])(
    '%s contains zero react, next/*, next-auth/react, or @/hooks/** imports',
    (fileName) => {
      const source = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

      expect(source).not.toMatch(/from\s+['"]react['"]/);
      expect(source).not.toMatch(/from\s+['"]next\//);
      expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
      expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
    }
  );
});

describe('authFlowStorage (#885)', () => {
  it('manages typed verification, password reset, delete-account, and callbackUrl keys in memory', () => {
    const storage = createInMemorySessionStorage();

    setPendingVerificationEmail('verify@example.com', storage);
    setPendingPasswordResetEmail('reset@example.com', storage);
    setPendingDeleteAccountEmail('delete@example.com', storage);
    persistPendingCallbackUrlFromSearch(
      '?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory',
      'https://xtalent.tw',
      storage
    );

    expect(getPendingVerificationEmail(storage)).toBe('verify@example.com');
    expect(getPendingPasswordResetEmail(storage)).toBe('reset@example.com');
    expect(getPendingDeleteAccountEmail(storage)).toBe('delete@example.com');
    expect(storage.dump()).toEqual({
      [PENDING_VERIFICATION_EMAIL_KEY]: 'verify@example.com',
      [PENDING_PASSWORD_RESET_EMAIL_KEY]: 'reset@example.com',
      [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'delete@example.com',
      [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee?tab=history',
    });

    expect(consumePendingCallbackUrl('https://xtalent.tw', storage)).toBe(
      '/reservation/mentee?tab=history'
    );
    expect(consumePendingCallbackUrl('https://xtalent.tw', storage)).toBeNull();

    clearPendingVerificationEmail(storage);
    clearPendingPasswordResetEmail(storage);
    clearPendingDeleteAccountEmail(storage);
    clearPendingCallbackUrl(storage);

    expect(storage.dump()).toEqual({});
  });

  it('clearAuthFlowStorage removes all pending auth keys while preserving unrelated sessionStorage entries', () => {
    const storage = createInMemorySessionStorage({
      [PENDING_VERIFICATION_EMAIL_KEY]: 'verify@example.com',
      [PENDING_PASSWORD_RESET_EMAIL_KEY]: 'reset@example.com',
      [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'delete@example.com',
      [PENDING_AUTH_CALLBACK_URL_KEY]: '/mentor-pool',
      'announcement-dismissed': 'true',
    });

    clearAuthFlowStorage(storage);

    for (const key of AUTH_FLOW_STORAGE_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem('announcement-dismissed')).toBe('true');
  });
});

describe('bffAuth (#885)', () => {
  it('resolves SSR_API_URL before NEXT_PUBLIC_API_URL and falls back to empty string', () => {
    expect(
      resolveBffBaseUrl({
        SSR_API_URL: 'http://bff:8000/api',
        NEXT_PUBLIC_API_URL: 'https://public.example.com/api',
      })
    ).toBe('http://bff:8000/api');

    expect(
      resolveBffBaseUrl({
        NEXT_PUBLIC_API_URL: 'https://public.example.com/api',
      })
    ).toBe('https://public.example.com/api');

    expect(resolveBffBaseUrl({})).toBe('');
  });

  it('normalizes BFF user payloads identically for credentials and custom-google-token providers', () => {
    const experiences = [
      {
        category: 'LINK',
        mentor_experiences_metadata: {
          data: [
            { platform: 'GitHub', url: 'https://github.com/alice' },
            { platform: 'XSS', url: 'javascript:alert(1)' },
          ],
        },
      },
    ];

    expect(resolveMentorExperienceLinks(experiences)).toEqual([
      { platform: 'GitHub', url: 'https://github.com/alice' },
    ]);

    const normalized = normalizeBffAuthUser({
      token: 'jwt_tok',
      refreshToken: 'rt_tok',
      email: 'alice@example.com',
      user: {
        user_id: 42,
        name: 'Alice Chen',
        avatar: 'https://cdn.example.com/a.png',
        avatar_updated_at: 1700000000,
        onboarding: true,
        is_mentor: true,
        job_title: null,
        company: 'XChange',
        experiences,
      },
    });

    expect(normalized).toEqual({
      id: '42',
      token: 'jwt_tok',
      refreshToken: 'rt_tok',
      email: 'alice@example.com',
      name: 'Alice Chen',
      avatar: 'https://cdn.example.com/a.png',
      avatarUpdatedAt: 1700000000,
      onBoarding: true,
      isMentor: true,
      jobTitle: '',
      company: 'XChange',
      personalLinks: [{ platform: 'GitHub', url: 'https://github.com/alice' }],
    });
  });
});

describe('sessionLifecycle (#885)', () => {
  beforeEach(() => {
    notificationStoreManager.clear();
    reservationReadModel.clear();
    scheduleReadModel.clear();
    document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
    document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
    document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
    document.documentElement.style.removeProperty('--auth-avatar');
  });

  describe('signInWithCredentials', () => {
    const validCredentials = {
      email: 'mentee@example.com',
      password: 'Password1!',
    };

    it('rejects invalid schema inputs in memory without invoking NextAuth signIn', async () => {
      const signIn = vi.fn();
      const getSession = vi.fn();
      const navigate = vi.fn();

      await expect(
        signInWithCredentials(
          { email: 'not-an-email', password: '' },
          { signIn, getSession, navigate }
        )
      ).rejects.toMatchObject({
        name: 'SignInLifecycleError',
        message: 'Invalid fields!',
        step: 'validate_credentials',
        level: 'info',
      });

      expect(signIn).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('throws SignInLifecycleError(authenticate) when NextAuth signIn returns an error', async () => {
      const signIn = vi
        .fn()
        .mockResolvedValue({ error: 'CredentialsSignin', ok: false });
      const getSession = vi.fn();
      const navigate = vi.fn();

      await expect(
        signInWithCredentials(validCredentials, {
          signIn,
          getSession,
          navigate,
        })
      ).rejects.toMatchObject({
        message: 'Invalid credentials!',
        step: 'authenticate',
        logMessage: 'Invalid credentials',
        errorCode: 'CredentialsSignin',
      });

      expect(getSession).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('throws SignInLifecycleError(get_session) when getSession lacks accessToken', async () => {
      const signIn = vi.fn().mockResolvedValue({ error: null, ok: true });
      const getSession = vi
        .fn()
        .mockResolvedValue(
          fromPartial<Session>({ user: { id: '10', onBoarding: true } })
        );
      const navigate = vi.fn();

      let caught: unknown;
      try {
        await signInWithCredentials(validCredentials, {
          signIn,
          getSession,
          navigate,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(SignInLifecycleError);
      expect(caught).toMatchObject({
        message: 'Login failed',
        step: 'get_session',
        logMessage: 'No access token after login',
        level: 'error',
      });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('syncs analytics, clears stale pending callbackUrl, and routes to sanitized callbackUrl or /auth/onboarding', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentor',
      });
      const signIn = vi.fn().mockResolvedValue({ error: null, ok: true });
      const setAnalyticsUserContext = vi.fn();
      const trackEvent = vi.fn();
      const navigate = vi.fn();

      // Case 1: onBoarding === true -> sanitized search callbackUrl wins
      await signInWithCredentials(validCredentials, {
        signIn,
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_1',
            user: { id: '77', onBoarding: true, isMentor: true },
          })
        ),
        navigate,
        search: '?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory',
        currentOrigin: 'https://xtalent.tw',
        storage,
        setAnalyticsUserContext,
        trackEvent,
      });

      expect(setAnalyticsUserContext).toHaveBeenCalledWith({
        userId: '77',
        userRole: 'mentor',
      });
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'login',
        feature: 'auth',
        metadata: { method: 'Email', user_role: 'mentor' },
      });
      expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/reservation/mentee?tab=history');

      // Case 2: onBoarding === false -> /auth/onboarding takes priority over callbackUrl
      navigate.mockClear();
      await signInWithCredentials(validCredentials, {
        signIn,
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_2',
            user: { id: '78', onBoarding: false, isMentor: false },
          })
        ),
        navigate,
        search: '?callbackUrl=%2Freservation%2Fmentee',
        currentOrigin: 'https://xtalent.tw',
        storage,
        setAnalyticsUserContext,
        trackEvent,
      });

      expect(navigate).toHaveBeenCalledWith('/auth/onboarding');
    });
  });

  describe('executeGoogleOAuthCallback', () => {
    it('handles INVALID outcomes by clearing pending storage keys, showing toast, and routing to /auth/signin', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
      });
      const navigate = vi.fn();
      const onToast = vi.fn();

      await executeGoogleOAuthCallback(
        { code: null, state: 'st' },
        {
          exchangeCode: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
          getSession: vi.fn(),
          navigate,
          onToast,
          storage,
        }
      );

      expect(storage.dump()).toEqual({});
      expect(onToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Missing Google OAuth parameters',
        description: 'Authorization failed. Please try again.',
      });
      expect(navigate).toHaveBeenCalledWith('/auth/signin');
    });

    it('handles SIGNUP outcome by storing verification email, clearing callbackUrl, tracking sign_up, and routing to /auth/email-verify', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
      });
      const navigate = vi.fn();
      const trackEvent = vi.fn();

      await executeGoogleOAuthCallback(
        { code: 'c1', state: 's1' },
        {
          exchangeCode: vi.fn().mockResolvedValue(
            fromPartial<OAuthCallbackResponse>({
              data: {
                auth_type: 'SIGNUP',
                auth: { token: 't1', email: 'new@example.com' },
                user: null,
              },
            })
          ),
          signIn: vi.fn(),
          signOut: vi.fn(),
          getSession: vi.fn(),
          navigate,
          onToast: vi.fn(),
          storage,
          trackEvent,
        }
      );

      expect(getPendingVerificationEmail(storage)).toBe('new@example.com');
      expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'sign_up',
        feature: 'auth',
        metadata: { method: 'Google', user_role: 'guest' },
      });
      expect(navigate).toHaveBeenCalledWith('/auth/email-verify');
    });

    it('guards against missing session accessToken on Google LOGIN just like credentials login', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
      });
      const navigate = vi.fn();
      const onToast = vi.fn();
      const setAnalyticsUserContext = vi.fn();

      await executeGoogleOAuthCallback(
        { code: 'c2', state: 's2' },
        {
          exchangeCode: vi.fn().mockResolvedValue(
            fromPartial<OAuthCallbackResponse>({
              data: {
                auth_type: 'LOGIN',
                auth: { token: 'tok_g', email: 'u@example.com' },
                user: fromPartial<ProfileVO>({ user_id: 88, is_mentor: false }),
              },
            })
          ),
          signIn: vi.fn().mockResolvedValue({ error: null, ok: true }),
          signOut: vi.fn(),
          getSession: vi
            .fn()
            .mockResolvedValue(
              fromPartial<Session>({ user: { id: '88', onBoarding: true } })
            ),
          navigate,
          onToast,
          storage,
          setAnalyticsUserContext,
        }
      );

      expect(setAnalyticsUserContext).not.toHaveBeenCalled();
      expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
      expect(onToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Login failed',
        description: 'Something went wrong during login.',
      });
      expect(navigate).toHaveBeenCalledWith('/auth/signin');
    });

    it('completes Google LOGIN choreography and consumes stored callbackUrl when onBoarding is true', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee?tab=history',
      });
      const navigate = vi.fn();
      const setAnalyticsUserContext = vi.fn();
      const trackEvent = vi.fn();

      await executeGoogleOAuthCallback(
        { code: 'c3', state: 's3' },
        {
          exchangeCode: vi.fn().mockResolvedValue(
            fromPartial<OAuthCallbackResponse>({
              data: {
                auth_type: 'LOGIN',
                auth: { token: 'tok_g', email: 'u@example.com' },
                user: fromPartial<ProfileVO>({ user_id: 88, is_mentor: true }),
              },
            })
          ),
          signIn: vi.fn().mockResolvedValue({ error: null, ok: true }),
          signOut: vi.fn(),
          getSession: vi.fn().mockResolvedValue(
            fromPartial<Session>({
              accessToken: 'tok_g',
              user: { id: '88', onBoarding: true, isMentor: true },
            })
          ),
          navigate,
          onToast: vi.fn(),
          currentOrigin: 'https://xtalent.tw',
          storage,
          setAnalyticsUserContext,
          trackEvent,
        }
      );

      expect(setAnalyticsUserContext).toHaveBeenCalledWith({
        userId: '88',
        userRole: 'mentor',
      });
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'login',
        feature: 'auth',
        metadata: { method: 'Google', user_role: 'mentor' },
      });
      expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/reservation/mentee?tab=history');
    });

    it('handles RESUME_DELETE_ACCOUNT across success, blocked_reservations, and error outcomes', async () => {
      const exchangeCode = vi.fn().mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            id_token: 'google_id_token',
            auth: { token: 'tok_del', email: 'del@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 99, name: 'Del User' }),
          },
        })
      );

      // 1. blocked_reservations -> routes to /reservation/mentee without signOut
      const blockedStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
      });
      const blockedNavigate = vi.fn();
      const blockedToast = vi.fn();
      const blockedSignOut = vi.fn();

      await executeGoogleOAuthCallback(
        { code: 'c', state: 's' },
        {
          exchangeCode,
          signIn: vi.fn().mockResolvedValue({ ok: true }),
          signOut: blockedSignOut,
          getSession: vi.fn(),
          navigate: blockedNavigate,
          onToast: blockedToast,
          storage: blockedStorage,
          deleteAccountFn: vi
            .fn()
            .mockResolvedValue({ status: 'blocked_reservations' }),
        }
      );

      expect(
        blockedStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
      ).toBeNull();
      expect(blockedSignOut).not.toHaveBeenCalled();
      expect(blockedNavigate).toHaveBeenCalledWith('/reservation/mentee');

      // 2. error -> routes to /auth/signin without signOut
      const errStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
      });
      const errNavigate = vi.fn();
      const errToast = vi.fn();
      const errSignOut = vi.fn();

      await executeGoogleOAuthCallback(
        { code: 'c', state: 's' },
        {
          exchangeCode,
          signIn: vi.fn().mockResolvedValue({ ok: true }),
          signOut: errSignOut,
          getSession: vi.fn(),
          navigate: errNavigate,
          onToast: errToast,
          storage: errStorage,
          deleteAccountFn: vi
            .fn()
            .mockResolvedValue({ status: 'error', message: 'Boom' }),
        }
      );

      expect(errSignOut).not.toHaveBeenCalled();
      expect(errToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description: 'Boom',
      });
      expect(errNavigate).toHaveBeenCalledWith('/auth/signin');

      // 3. success -> tracks delete_account_succeeded before teardown, runs revalidateAfterDelete, signs out to '/'
      const okStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
        [PENDING_PASSWORD_RESET_EMAIL_KEY]: 'stale@example.com',
      });
      const callOrder: string[] = [];
      const okSignOut = vi.fn(async () => {
        callOrder.push('signOut');
      });
      const revalidateAfterDelete = vi.fn(async () => {
        callOrder.push('revalidate');
      });

      await executeGoogleOAuthCallback(
        { code: 'c', state: 's' },
        {
          exchangeCode,
          signIn: vi.fn().mockResolvedValue({ ok: true }),
          signOut: okSignOut,
          getSession: vi.fn(),
          navigate: vi.fn(),
          onToast: vi.fn(),
          storage: okStorage,
          revalidateAfterDelete,
          deleteAccountFn: vi.fn().mockResolvedValue({ status: 'success' }),
          trackEvent: vi.fn(() => {
            callOrder.push('trackEvent');
          }),
          clearAnalyticsUser: vi.fn(() => {
            callOrder.push('clearAnalyticsUser');
          }),
          clearSessionHint: vi.fn(() => {
            callOrder.push('clearSessionHint');
          }),
        }
      );

      expect(okStorage.dump()).toEqual({});
      expect(okSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
      expect(callOrder).toEqual([
        'trackEvent',
        'clearSessionHint',
        'clearAnalyticsUser',
        'revalidate',
        'signOut',
      ]);
    });
  });

  describe('executeDeleteAccountXC & initiateGoogleDeleteAccountReauth', () => {
    it('covers success (including best-effort revalidate failure), blocked_reservations, and error', async () => {
      const blockedSignOut = vi.fn();
      const blockedRes = await executeDeleteAccountXC(
        { email: 'a@example.com', password: 'Password1!' },
        {
          signOut: blockedSignOut,
          deleteAccountFn: vi
            .fn()
            .mockResolvedValue({ status: 'blocked_reservations' }),
        }
      );
      expect(blockedRes).toEqual({ status: 'blocked_reservations' });
      expect(blockedSignOut).not.toHaveBeenCalled();

      const errRes = await executeDeleteAccountXC(
        { email: 'a@example.com', password: 'Password1!' },
        {
          signOut: blockedSignOut,
          deleteAccountFn: vi
            .fn()
            .mockResolvedValue({ status: 'error', message: 'Wrong password' }),
        }
      );
      expect(errRes).toEqual({ status: 'error', message: 'Wrong password' });
      expect(blockedSignOut).not.toHaveBeenCalled();

      const captureFailure = vi.fn();
      const okSignOut = vi.fn().mockResolvedValue(undefined);
      const storage = createInMemorySessionStorage({
        [PENDING_VERIFICATION_EMAIL_KEY]: 'stale@example.com',
      });

      const okRes = await executeDeleteAccountXC(
        { email: 'a@example.com', password: 'Password1!' },
        {
          signOut: okSignOut,
          storage,
          deleteAccountFn: vi.fn().mockResolvedValue({ status: 'success' }),
          revalidateAfterDelete: vi
            .fn()
            .mockRejectedValue(new Error('revalidate offline')),
          captureFailure,
          trackEvent: vi.fn(),
          clearAnalyticsUser: vi.fn(),
          clearSessionHint: vi.fn(),
        }
      );

      expect(okRes).toEqual({ status: 'success' });
      expect(storage.dump()).toEqual({});
      expect(captureFailure).toHaveBeenCalledWith({
        flow: 'delete_account',
        step: 'revalidate_dispatch',
        message: 'revalidate offline',
        level: 'warning',
      });
      expect(okSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });

    it('persists delete_account_email before Google reauth redirect and cleans it up on error', async () => {
      const storage = createInMemorySessionStorage();
      const navigate = vi.fn();

      await initiateGoogleDeleteAccountReauth('g@example.com', {
        navigate,
        storage,
        getAuthorizeUrl: vi.fn().mockResolvedValue({
          authorization_url: 'https://accounts.google.com/o/oauth2/auth',
          state: 'st',
        }),
      });

      expect(getPendingDeleteAccountEmail(storage)).toBe('g@example.com');
      expect(navigate).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/auth'
      );

      await expect(
        initiateGoogleDeleteAccountReauth('g@example.com', {
          navigate,
          storage,
          getAuthorizeUrl: vi.fn().mockRejectedValue(new Error('down')),
        })
      ).rejects.toThrow('down');

      expect(getPendingDeleteAccountEmail(storage)).toBeNull();
    });
  });

  describe('terminateClientSession across all 4 teardown reasons', () => {
    it.each<{
      reason: SessionTeardownReason;
      expectedSignOutArgs: [{ callbackUrl: string }] | [];
      expectsRevoke: boolean;
      expectsRevalidate: boolean;
    }>([
      {
        reason: 'logout',
        expectedSignOutArgs: [],
        expectsRevoke: true,
        expectsRevalidate: false,
      },
      {
        reason: 'refresh_token_error',
        expectedSignOutArgs: [{ callbackUrl: '/auth/signin' }],
        expectsRevoke: false,
        expectsRevalidate: false,
      },
      {
        reason: 'delete_account_xc',
        expectedSignOutArgs: [{ callbackUrl: '/' }],
        expectsRevoke: false,
        expectsRevalidate: true,
      },
      {
        reason: 'delete_account_google',
        expectedSignOutArgs: [{ callbackUrl: '/' }],
        expectsRevoke: false,
        expectsRevalidate: true,
      },
    ])(
      'deterministically clears sessionHint, analytics, authFlowStorage, notificationStoreManager, reservationReadModel, and scheduleReadModel on $reason',
      async ({
        reason,
        expectedSignOutArgs,
        expectsRevoke,
        expectsRevalidate,
      }) => {
        // Seed sessionHint cookie & DOM attributes
        document.cookie = `${SESSION_HINT_COOKIE}=1||https%3A%2F%2Fcdn.example.com%2Fa.png`;
        document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
        document.documentElement.setAttribute(
          DOM_AUTH_AVATAR_ATTR,
          'https://cdn.example.com/a.png'
        );
        document.documentElement.style.setProperty(
          '--auth-avatar',
          'url("https://cdn.example.com/a.png")'
        );

        // Seed authFlowStorage
        const storage = createInMemorySessionStorage({
          [PENDING_VERIFICATION_EMAIL_KEY]: 'v@example.com',
          [PENDING_PASSWORD_RESET_EMAIL_KEY]: 'r@example.com',
          [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'd@example.com',
          [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
        });

        // Seed all 3 user-scoped in-memory stores
        notificationStoreManager.getOrCreateState('user-42');
        notificationStoreManager.setInitialData(
          'user-42',
          2,
          [fromAny({ id: 1, unread: true })],
          null
        );
        const reservationKey = {
          userId: '42',
          state: 'MENTEE_UPCOMING' as const,
        };
        reservationReadModel.set(reservationKey, {
          items: [fromPartial<Reservation>({ id: 'res-1' })],
          next_dtend: 0,
        });
        const scheduleKey = { userId: '42', year: 2026, month: 11 };
        scheduleReadModel.set(scheduleKey, [fromAny({ id: 101 })]);

        expect(
          notificationStoreManager.getOrCreateState('user-42').unreadCountState
        ).toBe(2);
        expect(reservationReadModel.get(reservationKey)?.items).toHaveLength(1);
        expect(scheduleReadModel.get(scheduleKey)).toHaveLength(1);

        const clearAnalyticsUser = vi.fn();
        const revokeBackendSession = vi
          .fn()
          .mockRejectedValue(new Error('bff timeout'));
        const revalidateAfterDelete = vi.fn().mockResolvedValue(undefined);
        const signOut = vi.fn().mockResolvedValue(undefined);

        await terminateClientSession(reason, {
          signOut,
          storage,
          clearAnalyticsUser,
          revokeBackendSession,
          revalidateAfterDelete,
        });

        // 1. sessionHint cleared
        expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
        expect(
          document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
        ).toBeNull();
        expect(
          document.documentElement.getAttribute(DOM_AUTH_AVATAR_ATTR)
        ).toBeNull();
        expect(
          document.documentElement.style.getPropertyValue('--auth-avatar')
        ).toBe('');

        // 2. analytics cleared
        expect(clearAnalyticsUser).toHaveBeenCalledOnce();

        // 3. authFlowStorage cleared
        expect(storage.dump()).toEqual({});

        // 4. All 3 user-scoped stores cleared
        expect(
          notificationStoreManager.getOrCreateState('user-42').unreadCountState
        ).toBe(0);
        expect(reservationReadModel.get(reservationKey)).toBeUndefined();
        expect(scheduleReadModel.get(scheduleKey)).toBeUndefined();

        // 5. Reason-specific side effects
        expect(revokeBackendSession).toHaveBeenCalledTimes(
          expectsRevoke ? 1 : 0
        );
        expect(revalidateAfterDelete).toHaveBeenCalledTimes(
          expectsRevalidate ? 1 : 0
        );

        // 6. NextAuth signOut invoked with exact target options
        expect(signOut).toHaveBeenCalledOnce();
        expect(signOut).toHaveBeenCalledWith(...expectedSignOutArgs);
      }
    );
  });
});

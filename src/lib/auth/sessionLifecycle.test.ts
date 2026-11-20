import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import fs from 'fs';
import type { Session } from 'next-auth';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
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
import * as sessionLifecycleModule from '@/lib/auth/sessionLifecycle';
import {
  authLifecycle,
  type AuthLifecyclePort,
  clampOnboardingName,
  type ClientSignInFn,
  createAuthLifecycle,
  enrichGoogleLoginUserWithIdTokenFallback,
  extractGoogleIdTokenProfileFallback,
  type GoogleOAuthCodeExchanger,
  normalizeGoogleAvatarUrl,
  resolveOAuthOutcome,
  resolvePostAuthRedirect,
  sanitizeAuthErrorMessage,
  sanitizePrefillAvatarUrl,
  type SessionTeardownReason,
  signInWithGoogleToken,
  synthesizePreExchangedSession,
  terminateClientSession,
} from '@/lib/auth/sessionLifecycle';
import {
  favoriteMentorsReadModel,
  getPendingFavoriteMentorId,
  PENDING_FAVORITE_TTL_MS,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { notificationReadModel } from '@/lib/notifications';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import type { components } from '@/types/api';
import type { Reservation } from '@/types/reservation';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];
type ProfileVO = components['schemas']['ProfileVO'];

describe('auth deep modules boundary (#885 / #935 / #940)', () => {
  it.each(['authFlowStorage.ts', 'bffAuth.ts', 'sessionLifecycle.ts'])(
    '%s contains zero react, next/*, next-auth/react, or @/hooks/** imports',
    (fileName) => {
      const source = fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

      expect(source).not.toMatch(/from\s+['"]react['"]/);
      expect(source).not.toMatch(/from\s+['"]next\//);
      expect(source).not.toMatch(/from\s+['"]next-auth\/react['"]/);
      expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
    }
  );

  it('retires all 4 *LifecycleError classes, legacy *Adapters interfaces, and transitional wrapper functions while preserving terminateClientSession (#940)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'sessionLifecycle.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/LifecycleError\b/);
    expect(source).not.toMatch(/\binterface\s+\w*Adapters\b/);

    const retiredExports = [
      'SignInLifecycleError',
      'SignUpLifecycleError',
      'ConfirmSignUpLifecycleError',
      'PasswordResetLifecycleError',
      'signInWithCredentials',
      'signUpWithCredentials',
      'initiateGoogleAuth',
      'confirmSignUpToken',
      'resendVerificationEmailForPendingUser',
      'requestPasswordReset',
      'resendPasswordReset',
      'completePasswordReset',
      'executeDeleteAccountXC',
      'executeGoogleOAuthCallback',
    ];
    for (const symbol of retiredExports) {
      expect(symbol in sessionLifecycleModule).toBe(false);
    }

    expect(typeof sessionLifecycleModule.createAuthLifecycle).toBe('function');
    expect(typeof sessionLifecycleModule.terminateClientSession).toBe(
      'function'
    );
    expect(sessionLifecycleModule.authLifecycle).toBeDefined();
  });

  it('ensures all 10 src/hooks/auth/*.ts production hooks delegate to authLifecycle with zero direct authFlowStorage, LifecycleError, or useAsyncAction dependencies (#940)', () => {
    const hooksDir = path.resolve(__dirname, '../../hooks/auth');
    const allFiles = fs
      .readdirSync(hooksDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .sort();

    expect(allFiles).toEqual([
      'useAuthPendingAction.ts',
      'useConfirmRegister.ts',
      'useDeleteAccountForm.ts',
      'useEmailVerify.ts',
      'useGoogleAuth.ts',
      'useGoogleOAuthCallback.ts',
      'usePasswordForgotForm.ts',
      'usePasswordResend.ts',
      'usePasswordResetForm.ts',
      'useSignInForm.ts',
      'useSignUpForm.ts',
    ]);

    const helperSource = fs.readFileSync(
      path.join(hooksDir, 'useAuthPendingAction.ts'),
      'utf8'
    );
    expect(helperSource).not.toMatch(
      /authFlowStorage|LifecycleError|useAsyncAction/
    );

    const hookFiles = allFiles.filter((f) => f !== 'useAuthPendingAction.ts');
    for (const fileName of hookFiles) {
      const source = fs.readFileSync(path.join(hooksDir, fileName), 'utf8');
      expect(source, `${fileName} must import authLifecycle`).toMatch(
        /\bauthLifecycle\b/
      );
      expect(source, `${fileName} must not import authFlowStorage`).not.toMatch(
        /authFlowStorage/
      );
      expect(
        source,
        `${fileName} must not reference LifecycleError`
      ).not.toMatch(/LifecycleError/);
      expect(source, `${fileName} must not import useAsyncAction`).not.toMatch(
        /useAsyncAction/
      );
      expect(
        source,
        `${fileName} must delegate pending locks to useAuthPendingAction instead of manual inFlightRef`
      ).not.toMatch(/\binFlightRef\b/);
    }
  });
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

describe('sessionLifecycle (#885 / #935 / #940)', () => {
  const originalCanDelete = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;

  beforeEach(() => {
    window.localStorage.clear();
    notificationReadModel.clear();
    reservationReadModel.clear();
    scheduleReadModel.clear();
    favoriteMentorsReadModel.clear();
    profileReadModel.clear();
    mentorFeedbackReadModel.clear();
    document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
    document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
    document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
    document.documentElement.style.removeProperty('--auth-avatar');
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalCanDelete;
  });

  describe('signInWithCredentials via createAuthLifecycle', () => {
    const validCredentials = {
      email: 'mentee@example.com',
      password: 'Password1!',
    };

    it('distinguishes validate_credentials, authenticate, and get_session failures without leaking PII', async () => {
      const signIn = vi
        .fn()
        .mockResolvedValueOnce({ error: 'CredentialsSignin', ok: false })
        .mockResolvedValueOnce({ error: null, ok: true });
      const getSession = vi
        .fn()
        .mockResolvedValueOnce(
          fromPartial<Session>({ user: { id: '10', onBoarding: true } })
        );
      const navigate = vi.fn();
      const toast = vi.fn();
      const captureFailure = vi.fn();
      const trackEvent = vi.fn();
      const lifecycle = createAuthLifecycle({
        signIn,
        getSession,
        navigate,
        toast,
        captureFailure,
        trackEvent,
      });

      const invalidRes = await lifecycle.signInWithCredentials({
        email: 'not-an-email',
        password: '',
      });
      expect(invalidRes).toEqual({
        ok: false,
        errorType: 'validate_credentials',
      });
      expect(signIn).not.toHaveBeenCalled();

      const authRes = await lifecycle.signInWithCredentials(validCredentials);
      expect(authRes).toEqual({ ok: false, errorType: 'authenticate' });
      expect(toast).toHaveBeenLastCalledWith({
        variant: 'destructive',
        description: 'Invalid credentials!',
        duration: 1000,
      });
      expect(captureFailure).toHaveBeenLastCalledWith({
        flow: 'sign_in',
        step: 'authenticate',
        message: 'Invalid credentials',
        level: 'info',
        errorCode: 'CredentialsSignin',
      });
      expect(getSession).not.toHaveBeenCalled();

      const sessionRes =
        await lifecycle.signInWithCredentials(validCredentials);
      expect(sessionRes).toEqual({ ok: false, errorType: 'get_session' });
      expect(toast).toHaveBeenLastCalledWith({
        variant: 'destructive',
        description: 'Login failed',
        duration: 1000,
      });
      expect(captureFailure).toHaveBeenLastCalledWith({
        flow: 'sign_in',
        step: 'get_session',
        message: 'No access token after login',
        level: 'error',
        errorCode: undefined,
      });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('syncs analytics, clears stale pending callbackUrl, and routes across onboarding, mentor-onboarding (#969), and pendingFavoriteMentor (#733 / #756)', async () => {
      const storage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentor',
      });
      const signIn = vi.fn().mockResolvedValue({ error: null, ok: true });
      const setAnalyticsUserContext = vi.fn();
      const trackEvent = vi.fn();
      const navigate = vi.fn();
      const lifecycle = createAuthLifecycle({
        signIn,
        navigate,
        storage,
        setAnalyticsUserContext,
        trackEvent,
        getOrigin: () => 'https://xtalent.tw',
      });

      // 1. onBoarding === true -> sanitized search callbackUrl wins
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_1',
            user: { id: '77', onBoarding: true, isMentor: true },
          })
        ),
        search: '?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory',
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

      // 2. onBoarding === false -> /auth/onboarding priority, EXCEPT own mentor-onboarding=true (#969)
      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_2',
            user: { id: '78', onBoarding: false, isMentor: false },
          })
        ),
        search: '?callbackUrl=%2Freservation%2Fmentee',
      });
      expect(navigate).toHaveBeenCalledWith('/auth/onboarding');

      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_2c',
            user: { id: '78', onBoarding: false, isMentor: false },
          })
        ),
        search:
          '?callbackUrl=%2Fprofile%2F78%2Fedit%3Fmentor-onboarding%3Dtrue',
      });
      expect(navigate).toHaveBeenCalledWith(
        '/profile/78/edit?mentor-onboarding=true'
      );

      for (const rejectedCallback of [
        '?callbackUrl=%2Fprofile%2F999%2Fedit%3Fmentor-onboarding%3Dtrue',
        '?callbackUrl=%2Fprofile%2F78%2Fedit',
        '?callbackUrl=https%3A%2F%2Fevil.example%2Fprofile%2F78%2Fedit%3Fmentor-onboarding%3Dtrue',
      ]) {
        navigate.mockClear();
        await lifecycle.signInWithCredentials(validCredentials, {
          getSession: vi.fn().mockResolvedValue(
            fromPartial<Session>({
              accessToken: 'jwt_2d',
              user: { id: '78', onBoarding: false, isMentor: false },
            })
          ),
          search: rejectedCallback,
        });
        expect(navigate).toHaveBeenCalledWith('/auth/onboarding');
      }

      // isMentor === true with onBoarding === false treated as onboarded
      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_2b',
            user: { id: '780', onBoarding: false, isMentor: true },
          })
        ),
        search: '?callbackUrl=%2Freservation%2Fmentor',
      });
      expect(navigate).toHaveBeenCalledWith('/reservation/mentor');

      // 3. pendingFavoriteMentor redirect, onboarding preservation, conflict clearing, and TTL expiry (#756)
      navigate.mockClear();
      savePendingFavoriteMentor(101);
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_3',
            user: { id: '79', onBoarding: true, isMentor: false },
          })
        ),
      });
      expect(navigate).toHaveBeenCalledWith('/profile/101');
      expect(getPendingFavoriteMentorId()).toBe(101);

      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_fav_2',
            user: { id: '79', onBoarding: false, isMentor: false },
          })
        ),
      });
      expect(navigate).toHaveBeenCalledWith('/auth/onboarding');
      expect(getPendingFavoriteMentorId()).toBe(101);

      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_fav_3',
            user: { id: '79', onBoarding: true, isMentor: false },
          })
        ),
        search: '?callbackUrl=%2Freservation%2Fmentee',
      });
      expect(navigate).toHaveBeenCalledWith('/reservation/mentee');
      expect(getPendingFavoriteMentorId()).toBeNull();

      savePendingFavoriteMentor(
        101,
        Date.now() - PENDING_FAVORITE_TTL_MS - 1_000
      );
      navigate.mockClear();
      await lifecycle.signInWithCredentials(validCredentials, {
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_fav_4',
            user: { id: '79', onBoarding: true, isMentor: false },
          })
        ),
      });
      expect(navigate).toHaveBeenCalledWith('/mentor-pool');
      expect(getPendingFavoriteMentorId()).toBeNull();
    });
  });

  describe('handleGoogleOAuthCallback & delete/signUp status mappings via createAuthLifecycle', () => {
    it('handles INVALID, SIGNUP, missing accessToken, LOGIN callbackUrl/pendingFavorite/id_token fallback (#756 / #951), and RESUME_DELETE_ACCOUNT outcomes', async () => {
      const invalidStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
      });
      const invalidNavigate = vi.fn();
      const invalidToast = vi.fn();

      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        navigate: invalidNavigate,
        toast: invalidToast,
        storage: invalidStorage,
      }).handleGoogleOAuthCallback({ code: null, state: 'st' });

      expect(invalidStorage.dump()).toEqual({});
      expect(invalidToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Missing Google OAuth parameters',
        description: 'Authorization failed. Please try again.',
      });
      expect(invalidNavigate).toHaveBeenCalledWith('/auth/signin');

      // SIGNUP preserves pendingFavoriteMentor while storing verification email & clearing callbackUrl
      savePendingFavoriteMentor(303);
      const signupStorage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/profile/303',
      });
      const signupNavigate = vi.fn();
      const signupTrack = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn().mockResolvedValue(
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
        navigate: signupNavigate,
        toast: vi.fn(),
        storage: signupStorage,
        trackEvent: signupTrack,
      }).handleGoogleOAuthCallback({ code: 'c1', state: 's1' });

      expect(getPendingVerificationEmail(signupStorage)).toBe(
        'new@example.com'
      );
      expect(signupStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
      expect(signupTrack).toHaveBeenCalledWith({
        name: 'sign_up',
        feature: 'auth',
        metadata: { method: 'Google', user_role: 'guest' },
      });
      expect(signupNavigate).toHaveBeenCalledWith('/auth/email-verify');
      expect(getPendingFavoriteMentorId()).toBe(303);

      // Missing accessToken on Google LOGIN
      const missingTokStorage = createInMemorySessionStorage({
        [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
      });
      const missingTokToast = vi.fn();
      const missingTokNavigate = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn().mockResolvedValue(
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
        navigate: missingTokNavigate,
        toast: missingTokToast,
        storage: missingTokStorage,
      }).handleGoogleOAuthCallback({ code: 'c2', state: 's2' });
      expect(
        missingTokStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
      ).toBeNull();
      expect(missingTokToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Login failed',
        description: 'Something went wrong during login.',
      });
      expect(missingTokNavigate).toHaveBeenCalledWith('/auth/signin');

      // Google LOGIN pendingFavoriteMentor, conflicting callbackUrl, and #951 id_token =s512-c fallback
      const loginNavigate = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn().mockResolvedValue(
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
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'tok_g',
            user: { id: '88', onBoarding: true, isMentor: false },
          })
        ),
        navigate: loginNavigate,
        storage: createInMemorySessionStorage(),
        getOrigin: () => 'https://xtalent.tw',
        setAnalyticsUserContext: vi.fn(),
        trackEvent: vi.fn(),
      }).handleGoogleOAuthCallback({ code: 'c_fav', state: 's_fav' });
      expect(loginNavigate).toHaveBeenCalledWith('/profile/303');
      expect(getPendingFavoriteMentorId()).toBe(303);

      loginNavigate.mockClear();
      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn().mockResolvedValue(
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
        navigate: loginNavigate,
        storage: createInMemorySessionStorage({
          [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee?tab=history',
        }),
        getOrigin: () => 'https://xtalent.tw',
        setAnalyticsUserContext: vi.fn(),
        trackEvent: vi.fn(),
      }).handleGoogleOAuthCallback({ code: 'c_conflict', state: 's_conflict' });
      expect(loginNavigate).toHaveBeenCalledWith(
        '/reservation/mentee?tab=history'
      );
      expect(getPendingFavoriteMentorId()).toBeNull();

      const mockGoogleIdToken = buildTestJwt({
        name: '李杰克',
        picture: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s96-c',
      });
      const signInSpy = vi.fn().mockResolvedValue({ error: null, ok: true });
      loginNavigate.mockClear();
      await createAuthLifecycle({
        exchangeGoogleCode: vi.fn().mockResolvedValue(
          fromPartial<OAuthCallbackResponse>({
            data: {
              auth_type: 'LOGIN',
              id_token: mockGoogleIdToken,
              auth: { token: 'tok_fresh', email: 'fresh@example.com' },
              user: fromPartial<ProfileVO>({
                user_id: 951,
                onboarding: false,
              }),
            },
          })
        ),
        signIn: signInSpy,
        signOut: vi.fn(),
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'tok_fresh',
            user: {
              id: '951',
              name: '李杰克',
              avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s512-c',
              onBoarding: false,
              isMentor: false,
            },
          })
        ),
        navigate: loginNavigate,
        storage: createInMemorySessionStorage(),
        getOrigin: () => 'https://xtalent.tw',
        setAnalyticsUserContext: vi.fn(),
        trackEvent: vi.fn(),
      }).handleGoogleOAuthCallback({ code: 'c_fresh', state: 's_fresh' });

      expect(signInSpy).toHaveBeenCalledWith('custom-google-token', {
        redirect: false,
        token: 'tok_fresh',
        email: 'fresh@example.com',
        user: JSON.stringify({
          user_id: 951,
          onboarding: false,
          name: '李杰克',
          avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s512-c',
        }),
      });
      expect(loginNavigate).toHaveBeenCalledWith('/auth/onboarding');

      // RESUME_DELETE_ACCOUNT blocked_reservations & error
      const exchangeDeleteCode = vi.fn().mockResolvedValue(
        fromPartial<OAuthCallbackResponse>({
          data: {
            auth_type: 'LOGIN',
            id_token: 'google_id_token',
            auth: { token: 'tok_del', email: 'del@example.com' },
            user: fromPartial<ProfileVO>({ user_id: 99, name: 'Del User' }),
          },
        })
      );
      const blockedStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
      });
      const blockedNavigate = vi.fn();
      const blockedSignOut = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: exchangeDeleteCode,
        signIn: vi.fn().mockResolvedValue({ ok: true }),
        signOut: blockedSignOut,
        getSession: vi.fn(),
        navigate: blockedNavigate,
        toast: vi.fn(),
        storage: blockedStorage,
        authClient: {
          deleteAccount: vi
            .fn()
            .mockResolvedValue({ status: 'blocked_reservations' }),
        },
      }).handleGoogleOAuthCallback({ code: 'c', state: 's' });
      expect(
        blockedStorage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)
      ).toBeNull();
      expect(blockedSignOut).not.toHaveBeenCalled();
      expect(blockedNavigate).toHaveBeenCalledWith('/reservation/mentee');

      const errStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
      });
      const errNavigate = vi.fn();
      const errToast = vi.fn();
      const errCapture = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: exchangeDeleteCode,
        signIn: vi.fn().mockResolvedValue({ ok: true }),
        signOut: vi.fn(),
        getSession: vi.fn(),
        navigate: errNavigate,
        toast: errToast,
        captureFailure: errCapture,
        storage: errStorage,
        authClient: {
          deleteAccount: vi.fn().mockResolvedValue({
            status: 'error',
            message:
              'Delete failed for del@example.com idToken=google_id_token access=tok_del userId=99',
          }),
        },
      }).handleGoogleOAuthCallback({ code: 'c', state: 's' });
      expect(errCapture).toHaveBeenCalledWith({
        flow: 'delete_account',
        step: 'google_reauth_submit',
        level: 'info',
        message:
          'Delete failed for [REDACTED] idToken=[REDACTED] access=[REDACTED] userId=[REDACTED]',
      });
      expect(JSON.stringify(errCapture.mock.calls)).not.toContain(
        'google_id_token'
      );
      expect(JSON.stringify(errCapture.mock.calls)).not.toContain('tok_del');
      expect(JSON.stringify(errCapture.mock.calls)).not.toContain(
        'del@example.com'
      );
      expect(errToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description:
          'Delete failed for del@example.com idToken=google_id_token access=tok_del userId=99',
      });
      expect(errNavigate).toHaveBeenCalledWith('/auth/signin');

      const thrownStorage = createInMemorySessionStorage({
        [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'del@example.com',
      });
      const thrownNavigate = vi.fn();
      const thrownToast = vi.fn();
      const thrownCapture = vi.fn();
      await createAuthLifecycle({
        exchangeGoogleCode: exchangeDeleteCode,
        signIn: vi.fn().mockResolvedValue({ ok: true }),
        signOut: vi.fn(),
        getSession: vi.fn(),
        navigate: thrownNavigate,
        toast: thrownToast,
        captureFailure: thrownCapture,
        storage: thrownStorage,
        authClient: {
          deleteAccount: vi
            .fn()
            .mockRejectedValue(
              new ApiError(
                502,
                'Upstream rejected google_id_token for del@example.com (tok_del, {"user_id":99})'
              )
            ),
        },
      }).handleGoogleOAuthCallback({ code: 'c', state: 's' });
      expect(thrownCapture).toHaveBeenCalledWith({
        flow: 'delete_account',
        step: 'google_reauth_submit',
        level: 'info',
        errorCode: '502',
        message:
          'Upstream rejected [REDACTED] for [REDACTED] ([REDACTED], {"user_id":"[REDACTED]"})',
      });
      expect(JSON.stringify(thrownCapture.mock.calls)).not.toContain(
        'google_id_token'
      );
      expect(JSON.stringify(thrownCapture.mock.calls)).not.toContain('tok_del');
      expect(JSON.stringify(thrownCapture.mock.calls)).not.toContain(
        'del@example.com'
      );
      expect(JSON.stringify(thrownCapture.mock.calls)).not.toContain('99');
      expect(thrownToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description:
          'Upstream rejected google_id_token for del@example.com (tok_del, {"user_id":99})',
      });
      expect(thrownNavigate).toHaveBeenCalledWith('/auth/signin');
    });

    it('covers deleteAccountXC revalidate warning, signUp ApiError status codes (422/406/429/503), and confirmSignUp missing_token', async () => {
      const captureFailure = vi.fn();
      const toast = vi.fn();
      const signOut = vi.fn().mockResolvedValue(undefined);
      const storage = createInMemorySessionStorage({
        [PENDING_VERIFICATION_EMAIL_KEY]: 'stale@example.com',
      });

      const okDel = await createAuthLifecycle({
        signOut,
        storage,
        toast,
        captureFailure,
        revalidateAfterDelete: vi
          .fn()
          .mockRejectedValue(new Error('revalidate offline')),
        authClient: {
          deleteAccount: vi.fn().mockResolvedValue({ status: 'success' }),
        },
        clearAnalyticsUser: vi.fn(),
      }).deleteAccountXC({ email: 'a@example.com', password: 'Password1!' });

      expect(okDel).toEqual({ status: 'success' });
      expect(storage.dump()).toEqual({});
      expect(captureFailure).toHaveBeenCalledWith({
        flow: 'delete_account',
        step: 'revalidate_dispatch',
        message: 'revalidate offline',
        level: 'warning',
      });
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });

      for (const c of [
        {
          error: new ApiError(422, '欄位格式錯誤'),
          title: '驗證失敗',
          description: '欄位格式錯誤',
          code: '422',
        },
        {
          error: new ApiError(406, ''),
          title: '註冊失敗',
          description: '此電子郵件已被註冊。請使用其他電子郵件或登錄。',
          code: '406',
        },
        {
          error: new ApiError(429, ''),
          title: '請求過於頻繁',
          description: '您已超出最大註冊嘗試次數。請稍後再試。',
          code: '429',
        },
        {
          error: new ApiError(503, 'Down'),
          title: '註冊失敗',
          description: 'Down - HTTP狀態碼: 503。',
          code: '503',
        },
      ]) {
        toast.mockClear();
        const res = await createAuthLifecycle({
          toast,
          captureFailure,
          trackEvent: vi.fn(),
          authClient: { signUp: vi.fn().mockRejectedValue(c.error) },
        }).signUpWithCredentials({
          email: 'a@example.com',
          password: 'Password1!',
          confirm_password: 'Password1!',
        });
        expect(res).toEqual({ ok: false, errorType: c.code });
        expect(toast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: c.title,
          description: c.description,
          duration: 5000,
        });
      }

      const verifyStorage = createInMemorySessionStorage({
        [PENDING_VERIFICATION_EMAIL_KEY]: 'pending-pii@example.com',
      });
      toast.mockClear();
      const missingConfirm = await createAuthLifecycle({
        storage: verifyStorage,
        toast,
        captureFailure,
        trackEvent: vi.fn(),
      }).confirmSignUp(null);
      expect(missingConfirm).toEqual({ ok: false, status: 'failure' });
      expect(getPendingVerificationEmail(verifyStorage)).toBe(
        'pending-pii@example.com'
      );
    });
  });

  describe('resolvePostAuthRedirect', () => {
    it('resolves post-auth redirect priority using route constants and cleans up conflicting pendingFavoriteMentor', () => {
      const baseTime = 1_760_000_000_000;

      savePendingFavoriteMentor(101, baseTime);
      const redirectToFavorite = resolvePostAuthRedirect({
        explicitCallbackUrl: null,
        isOnboarded: true,
        now: baseTime + 1000,
      });
      expect(redirectToFavorite).toBe('/profile/101');
      expect(getPendingFavoriteMentorId(baseTime + 1000)).toBe(101);

      const redirectToOnboarding = resolvePostAuthRedirect({
        explicitCallbackUrl: '/profile/101',
        isOnboarded: false,
        now: baseTime + 2000,
      });
      expect(redirectToOnboarding).toBe('/auth/onboarding');
      expect(getPendingFavoriteMentorId(baseTime + 2000)).toBe(101);

      const redirectConflictUnonboarded = resolvePostAuthRedirect({
        explicitCallbackUrl: '/reservation/mentee?tab=history',
        isOnboarded: false,
        now: baseTime + 3000,
      });
      expect(redirectConflictUnonboarded).toBe('/auth/onboarding');
      expect(getPendingFavoriteMentorId(baseTime + 3000)).toBeNull();

      const redirectDefault = resolvePostAuthRedirect({
        explicitCallbackUrl: null,
        isOnboarded: true,
        now: baseTime + 4000,
      });
      expect(redirectDefault).toBe('/mentor-pool');
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
      'deterministically clears sessionHint, analytics, authFlowStorage, pendingFavoriteMentor, notificationReadModel, reservationReadModel, scheduleReadModel, favoriteMentorsReadModel, profileReadModel, and mentorFeedbackReadModel on $reason',
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

        // Seed authFlowStorage & pendingFavoriteMentor localStorage
        const storage = createInMemorySessionStorage({
          [PENDING_VERIFICATION_EMAIL_KEY]: 'v@example.com',
          [PENDING_PASSWORD_RESET_EMAIL_KEY]: 'r@example.com',
          [PENDING_DELETE_ACCOUNT_EMAIL_KEY]: 'd@example.com',
          [PENDING_AUTH_CALLBACK_URL_KEY]: '/reservation/mentee',
        });
        savePendingFavoriteMentor(101);
        expect(getPendingFavoriteMentorId()).toBe(101);

        // Seed all 6 user-scoped in-memory read models
        notificationReadModel.getOrCreateState('user-42');
        notificationReadModel.setInitialData(
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
        favoriteMentorsReadModel.seed('42', [
          fromAny({ user_id: 301, name: 'Mentor 301' }),
        ]);
        const profileKey = { userId: 42, language: 'zh_TW' };
        profileReadModel.prime(
          profileKey,
          fromAny({ user_id: 42, name: 'Cached User' })
        );
        mentorFeedbackReadModel.set(
          { mentorId: 42, page: 1 },
          {
            items: [],
            totalRatingCount: 0,
            page: 1,
            pageSize: 10,
            ratingAverage: null,
            completedMeetingCount: 0,
          }
        );

        expect(
          notificationReadModel.getOrCreateState('user-42').unreadCountState
        ).toBe(2);
        expect(reservationReadModel.get(reservationKey)?.items).toHaveLength(1);
        expect(scheduleReadModel.get(scheduleKey)).toHaveLength(1);
        expect(favoriteMentorsReadModel.getSnapshot('42')).toBeDefined();
        expect(profileReadModel.get(profileKey)).toBeDefined();
        expect(
          mentorFeedbackReadModel.get({ mentorId: 42, page: 1 })
        ).toBeDefined();

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

        // 3. authFlowStorage & pendingFavoriteMentor cleared
        expect(storage.dump()).toEqual({});
        expect(getPendingFavoriteMentorId()).toBeNull();

        // 4. All user-scoped stores and read models cleared (#908 / #935)
        expect(
          notificationReadModel.getOrCreateState('user-42').unreadCountState
        ).toBe(0);
        expect(reservationReadModel.get(reservationKey)).toBeUndefined();
        expect(scheduleReadModel.get(scheduleKey)).toBeUndefined();
        expect(favoriteMentorsReadModel.getSnapshot('42')).toBeUndefined();
        expect(profileReadModel.get(profileKey)).toBeUndefined();
        expect(
          mentorFeedbackReadModel.get({ mentorId: 42, page: 1 })
        ).toBeUndefined();

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

    it('prevents stale pendingFavoriteMentor from redirecting the next signed-in user after logout (#756)', async () => {
      savePendingFavoriteMentor(101);
      expect(getPendingFavoriteMentorId()).toBe(101);

      await terminateClientSession('logout', {
        signOut: vi.fn().mockResolvedValue(undefined),
        revokeBackendSession: vi.fn().mockResolvedValue(undefined),
        clearAnalyticsUser: vi.fn(),
        clearSessionHint: vi.fn(),
      });

      expect(getPendingFavoriteMentorId()).toBeNull();

      const navigate = vi.fn();
      await createAuthLifecycle({
        signIn: vi.fn().mockResolvedValue({ error: null, ok: true }),
        getSession: vi.fn().mockResolvedValue(
          fromPartial<Session>({
            accessToken: 'jwt_user_b',
            user: { id: '88', onBoarding: true, isMentor: false },
          })
        ),
        navigate,
        getOrigin: () => 'https://xtalent.tw',
        setAnalyticsUserContext: vi.fn(),
        trackEvent: vi.fn(),
      }).signInWithCredentials({
        email: 'user-b@example.com',
        password: 'Password1!',
      });

      expect(navigate).toHaveBeenCalledWith('/mentor-pool');
    });

    it('coalesces concurrent refresh_token_error teardowns across apiClient and SessionErrorWatcher into a single signOut call (#895)', async () => {
      let resolveSignOut: () => void = () => {};
      const signOut = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSignOut = resolve;
          })
      );
      const clearAnalyticsUser = vi.fn();
      const clearSessionHint = vi.fn();

      const t1 = terminateClientSession('refresh_token_error', {
        signOut,
        clearAnalyticsUser,
        clearSessionHint,
      });
      const t2 = terminateClientSession('refresh_token_error', {
        signOut,
        clearAnalyticsUser,
        clearSessionHint,
      });

      expect(signOut).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' });

      resolveSignOut();
      await Promise.all([t1, t2]);

      expect(clearAnalyticsUser).toHaveBeenCalledTimes(1);
      expect(clearSessionHint).toHaveBeenCalledTimes(1);
    });
  });
});

function buildTestJwt(
  payload: Record<string, unknown>,
  signature = 'sig'
): string {
  const encodePart = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  return `${encodePart({ alg: 'RS256', typ: 'JWT' })}.${encodePart(payload)}.${signature}`;
}

describe('merged Google OAuth outcome & profile fallback helpers (#935)', () => {
  it('signInWithGoogleToken invokes custom-google-token provider and throws when error is returned', async () => {
    const mockSignIn = vi.fn<ClientSignInFn>().mockResolvedValue({
      error: undefined,
      ok: true,
    });

    await signInWithGoogleToken(
      mockSignIn,
      'token123',
      'user@example.com',
      { id: 'user-1' },
      'bridge-tok'
    );

    expect(mockSignIn).toHaveBeenCalledWith('custom-google-token', {
      redirect: false,
      token: 'token123',
      email: 'user@example.com',
      user: '{"id":"user-1"}',
      refreshBridge: 'bridge-tok',
    });

    mockSignIn.mockResolvedValueOnce({ error: 'OAuthSigninError', ok: false });
    await expect(
      signInWithGoogleToken(mockSignIn, 'token123', 'user@example.com', {
        id: 'user-1',
      })
    ).rejects.toThrow('OAuthSigninError');
  });

  it('resolveOAuthOutcome validates required fields in one place (LOGIN user/token & RESUME_DELETE_ACCOUNT id_token/user/token)', async () => {
    const mockExchangeCode = vi.fn<GoogleOAuthCodeExchanger>();

    expect(
      await resolveOAuthOutcome(null, 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'INVALID', errorType: 'MISSING_PARAMS' });
    expect(mockExchangeCode).not.toHaveBeenCalled();

    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({ code: '1' })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });

    mockExchangeCode.mockRejectedValueOnce(new Error('network down'));
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'INVALID', errorType: 'CALLBACK_FAILED' });

    // LOGIN missing user or auth.token -> INVALID(missing_login_data) directly in resolveOAuthOutcome
    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          auth: { token: '', email: 'u@example.com' },
          user: fromPartial<ProfileVO>({ user_id: 1 }),
        },
      })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'INVALID', errorType: 'missing_login_data' });

    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          auth: { token: 'tok_123', email: 'u@example.com' },
          user: null,
        },
      })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'INVALID', errorType: 'missing_login_data' });

    // Valid LOGIN
    const validLoginData = fromPartial<GoogleCallbackVO>({
      auth_type: 'LOGIN',
      auth: { token: 'tok_123', email: 'u@example.com' },
      user: fromPartial<ProfileVO>({ user_id: 123 }),
    });
    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({ data: validLoginData })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
      })
    ).toEqual({ type: 'LOGIN', data: validLoginData });

    // Delete-account flow: missing id_token or SIGNUP auth_type -> INVALID(DELETE_FLOW_INVALID) directly in resolveOAuthOutcome
    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          id_token: null,
          auth: { token: 'tok_123', email: 'u@example.com' },
          user: fromPartial<ProfileVO>({ user_id: 123 }),
        },
      })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
        pendingDeleteAccountEmail: 'delete@example.com',
      })
    ).toEqual({ type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' });

    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'SIGNUP',
          auth: { token: 'tok_123', email: 'u@example.com' },
          user: null,
        },
      })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
        pendingDeleteAccountEmail: 'delete@example.com',
      })
    ).toEqual({ type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' });

    // Valid RESUME_DELETE_ACCOUNT
    const validDeleteData = fromPartial<GoogleCallbackVO>({
      auth_type: 'LOGIN',
      id_token: 'id_tok_123',
      auth: { token: 'tok_123', email: 'u@example.com' },
      user: fromPartial<ProfileVO>({ user_id: 123 }),
    });
    mockExchangeCode.mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({ data: validDeleteData })
    );
    expect(
      await resolveOAuthOutcome('code', 'state', {
        exchangeCode: mockExchangeCode,
        pendingDeleteAccountEmail: 'delete@example.com',
      })
    ).toEqual({
      type: 'RESUME_DELETE_ACCOUNT',
      data: validDeleteData,
      email: 'delete@example.com',
    });
  });

  it('preserves Google avatar =s512-c normalization, id_token fallback, and pre-exchanged session synthesis (#951 / #954)', () => {
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
        'https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s96-c'
      )
    ).toBe('https://lh3.googleusercontent.com/a/ACg8ocJ_test123=s512-c');
    expect(
      sanitizePrefillAvatarUrl(
        'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/a.png'
      )
    ).toBe(
      'https://x-career-multimedia.s3.ap-northeast-1.amazonaws.com/avatars/1/a.png'
    );

    expect(clampOnboardingName('Christopher Montgomery')).toBe(
      'Christopher Montgome'
    );
    expect(clampOnboardingName('1234567890123456789😀extra')).toBe(
      '1234567890123456789'
    );
    expect(clampOnboardingName('   ')).toBeUndefined();
    expect(clampOnboardingName(null)).toBeUndefined();

    const idToken = buildTestJwt({
      name: '  陳渝軒 Bonny  ',
      picture: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s96-c',
    });
    expect(extractGoogleIdTokenProfileFallback(idToken)).toEqual({
      name: '陳渝軒 Bonny',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s512-c',
    });

    const splitNameToken = buildTestJwt({
      given_name: 'Jack',
      family_name: 'Lee',
      picture: 'https://lh3.googleusercontent.com/a/ACg8ocJack',
    });
    expect(extractGoogleIdTokenProfileFallback(splitNameToken)).toEqual({
      name: 'Jack Lee',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJack=s512-c',
    });
    expect(extractGoogleIdTokenProfileFallback('not-a-jwt')).toEqual({});
    expect(extractGoogleIdTokenProfileFallback('a.!!!invalid!!!.c')).toEqual(
      {}
    );
    expect(extractGoogleIdTokenProfileFallback('a.____.c')).toEqual({});
    const jwtHeader = Buffer.from(
      JSON.stringify({ alg: 'RS256' }),
      'utf8'
    ).toString('base64url');
    const invalidUtf8InJson = Buffer.from([
      0x7b, 0x22, 0x6e, 0x61, 0x6d, 0x65, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d,
    ]).toString('base64url');
    expect(
      extractGoogleIdTokenProfileFallback(
        `${jwtHeader}.${invalidUtf8InJson}.sig`
      )
    ).toEqual({});
    const arrayJwt = `${jwtHeader}.${Buffer.from('[1,2,3]', 'utf8').toString('base64url')}.sig`;
    expect(extractGoogleIdTokenProfileFallback(arrayJwt)).toEqual({});
    expect(extractGoogleIdTokenProfileFallback(null)).toEqual({});

    expect(
      enrichGoogleLoginUserWithIdTokenFallback(
        { user_id: 101, onboarding: false },
        idToken
      )
    ).toEqual({
      user_id: 101,
      onboarding: false,
      name: '陳渝軒 Bonny',
      avatar: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s512-c',
    });
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

    const synthesized = synthesizePreExchangedSession({
      response: {
        code: '0',
        msg: 'ok',
        data: {
          auth_type: 'LOGIN',
          id_token: idToken,
          auth: { token: 'jwt_954', email: 'member@example.com', user_id: 954 },
          user: {
            user_id: 954,
            name: '',
            avatar: '',
            onboarding: false,
            is_mentor: true,
            job_title: 'Staff Engineer',
            company: 'XChange',
          } as never,
        },
      },
      refreshBridgeToken: 'sealed_bridge',
    });
    expect(synthesized).toMatchObject({
      accessToken: 'jwt_954',
      user: {
        id: '954',
        name: '陳渝軒 Bonny',
        avatar: 'https://lh3.googleusercontent.com/a/ACg8ocBonny=s512-c',
      },
    });
    expect(
      synthesizePreExchangedSession({
        response: {
          code: '0',
          msg: 'ok',
          data: {
            auth_type: 'SIGNUP',
            auth: { email: 'new@example.com', token: '', user_id: 1 },
            user: null,
          } as never,
        },
        refreshBridgeToken: null,
      })
    ).toBeNull();
  });
});

describe('createAuthLifecycle(port) unified port & atomic teardown (#935)', () => {
  const originalCanDelete = process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT;

  beforeEach(() => {
    window.localStorage.clear();
    notificationReadModel.clear();
    reservationReadModel.clear();
    scheduleReadModel.clear();
    favoriteMentorsReadModel.clear();
    profileReadModel.clear();
    mentorFeedbackReadModel.clear();
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'true';
  });

  function createFakePort(overrides: Partial<AuthLifecyclePort> = {}) {
    const storage = createInMemorySessionStorage();
    const port: Required<
      Pick<
        AuthLifecyclePort,
        | 'signIn'
        | 'signOut'
        | 'getSession'
        | 'exchangeGoogleCode'
        | 'revalidateAfterDelete'
        | 'navigate'
        | 'toast'
        | 'trackEvent'
        | 'setAnalyticsUserContext'
        | 'clearAnalyticsUser'
        | 'captureFailure'
      >
    > &
      AuthLifecyclePort = {
      authClient: {
        signUp: vi.fn().mockResolvedValue(undefined),
        confirmSignUp: vi.fn().mockResolvedValue(undefined),
        resendVerificationEmail: vi.fn().mockResolvedValue(undefined),
        requestPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
        resetPasswordWithToken: vi.fn().mockResolvedValue(undefined),
        getGoogleAuthorizeUrl: vi.fn().mockResolvedValue({
          authorization_url: 'https://accounts.google.com/o/oauth2/auth',
          state: 'st-1',
        }),
        deleteAccount: vi.fn().mockResolvedValue({ status: 'success' }),
        postBackendLogout: vi.fn().mockResolvedValue(undefined),
      },
      signIn: vi.fn().mockResolvedValue({ error: null, ok: true }),
      signOut: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue(
        fromPartial<Session>({
          accessToken: 'jwt_tok',
          user: { id: '42', onBoarding: true, isMentor: false },
        })
      ),
      exchangeGoogleCode: vi.fn(),
      revalidateAfterDelete: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      toast: vi.fn(),
      storage,
      trackEvent: vi.fn(),
      setAnalyticsUserContext: vi.fn(),
      clearAnalyticsUser: vi.fn(),
      captureFailure: vi.fn(),
      getSearch: () => '',
      getOrigin: () => 'https://xtalent.tw',
      ...overrides,
    };
    return { port, storage };
  }

  it('exposes default authLifecycle singleton instance', () => {
    expect(authLifecycle).toBeDefined();
    expect(typeof authLifecycle.signInWithCredentials).toBe('function');
    expect(typeof authLifecycle.terminateSession).toBe('function');
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalCanDelete;
  });

  it('orchestrates signInWithCredentials, signUpWithCredentials, and startGoogleAuth with unified toast, telemetry, and zero-PII Sentry capture', async () => {
    const { port, storage } = createFakePort({
      getSearch: () => '?callbackUrl=%2Freservation%2Fmentee',
    });
    const lifecycle = createAuthLifecycle(port);

    // 1. Sign-in validation failure
    const invalidRes = await lifecycle.signInWithCredentials({
      email: 'bad-email',
      password: '',
    });
    expect(invalidRes).toEqual({
      ok: false,
      errorType: 'validate_credentials',
    });
    expect(port.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Invalid fields!',
        duration: 1000,
      })
    );
    expect(port.trackEvent).toHaveBeenCalledWith({
      name: 'auth_flow_failed',
      feature: 'auth',
      metadata: { flow: 'login', error_type: 'validate_credentials' },
    });
    expect(port.captureFailure).toHaveBeenCalledWith({
      flow: 'sign_in',
      step: 'validate_credentials',
      level: 'info',
      message: 'Invalid fields!',
      errorCode: undefined,
    });

    // 2. Sign-in unexpected error scrubs PII
    vi.mocked(port.signIn).mockRejectedValueOnce(
      new Error('Auth failed for secret@example.com password=MyPassword1!')
    );
    const unexpectedRes = await lifecycle.signInWithCredentials({
      email: 'secret@example.com',
      password: 'MyPassword1!',
    });
    expect(unexpectedRes).toEqual({ ok: false, errorType: 'unexpected' });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('secret@example.com');
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('MyPassword1!');

    // 3. Sign-in success
    const loginOk = await lifecycle.signInWithCredentials({
      email: 'mentee@example.com',
      password: 'Password1!',
    });
    expect(loginOk).toEqual({ ok: true });
    expect(port.navigate).toHaveBeenCalledWith('/reservation/mentee');

    // 4. Sign-up started + sign-up failure + sign-up success
    lifecycle.trackSignUpStarted();
    expect(port.trackEvent).toHaveBeenCalledWith({
      name: 'sign_up_started',
      feature: 'auth',
    });

    vi.mocked(port.authClient!.signUp!).mockRejectedValueOnce(
      new ApiError(406, 'Email secret-new@example.com already registered')
    );
    const signUpErr = await lifecycle.signUpWithCredentials({
      email: 'secret-new@example.com',
      password: 'Password1!',
      confirm_password: 'Password1!',
    });
    expect(signUpErr).toEqual({ ok: false, errorType: '406' });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('secret-new@example.com');

    const signUpOk = await lifecycle.signUpWithCredentials({
      email: 'new@example.com',
      password: 'Password1!',
      confirm_password: 'Password1!',
    });
    expect(signUpOk).toEqual({ ok: true });
    expect(lifecycle.getPendingVerificationEmail()).toBe('new@example.com');
    expect(port.navigate).toHaveBeenCalledWith('/auth/email-verify');

    // 5. Google OAuth start login + error rollback
    const googleOk = await lifecycle.startGoogleAuth({ isSignIn: true });
    expect(googleOk).toEqual({ ok: true });
    expect(port.trackEvent).toHaveBeenCalledWith({
      name: 'auth_oauth_started',
      feature: 'auth',
      metadata: { method: 'Google', flow: 'login' },
    });
    expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBe(
      '/reservation/mentee'
    );

    vi.mocked(port.authClient!.getGoogleAuthorizeUrl!).mockRejectedValueOnce(
      new ApiError(502, 'OAuth down')
    );
    const googleErr = await lifecycle.startGoogleAuth({ isSignIn: false });
    expect(googleErr).toEqual({ ok: false, errorType: '502' });
    expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
    expect(port.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      })
    );
  });

  it('orchestrates confirmSignUp (including email_verified telemetry & stale-token guard), resendVerificationEmail, and password reset flows without leaking PII', async () => {
    const { port, storage } = createFakePort();
    const lifecycle = createAuthLifecycle(port);

    storage.setItem(PENDING_VERIFICATION_EMAIL_KEY, 'verify-me@example.com');

    // Stale token response is ignored cleanly
    const staleRes = await lifecycle.confirmSignUp('stale-tok-1', {
      isCurrent: () => false,
    });
    expect(staleRes).toEqual({ ok: false, status: 'stale' });
    expect(port.trackEvent).not.toHaveBeenCalled();

    // Token failure logs without raw token
    vi.mocked(port.authClient!.confirmSignUp!).mockRejectedValueOnce(
      new ApiError(400, 'Token raw-secret-tok-777 expired')
    );
    const failConfirm = await lifecycle.confirmSignUp('raw-secret-tok-777');
    expect(failConfirm).toEqual({ ok: false, status: 'failure' });
    expect(port.trackEvent).toHaveBeenCalledWith({
      name: 'auth_flow_failed',
      feature: 'auth',
      metadata: { flow: 'email_verify', error_type: 'confirm_token' },
    });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('raw-secret-tok-777');

    // Resend verification email reads stored email and shows toast
    const resendOk = await lifecycle.resendVerificationEmail();
    expect(resendOk).toEqual({ ok: true });
    expect(port.authClient!.resendVerificationEmail).toHaveBeenCalledWith(
      'verify-me@example.com'
    );
    expect(port.toast).toHaveBeenCalledWith({
      variant: 'default',
      title: '已重新寄送',
      description: '驗證信已重新寄送！',
    });

    // Confirm sign-up success tracks email_verified and clears pending email
    vi.mocked(port.trackEvent).mockClear();
    const okConfirm = await lifecycle.confirmSignUp('valid-tok-888');
    expect(okConfirm).toEqual({ ok: true, status: 'success' });
    expect(port.trackEvent).toHaveBeenCalledWith({
      name: 'email_verified',
      feature: 'auth',
    });
    expect(lifecycle.getPendingVerificationEmail()).toBeNull();

    // Missing email on resendVerificationEmail & resendPasswordReset
    expect(await lifecycle.resendVerificationEmail()).toEqual({
      ok: false,
      errorType: 'resend_failed',
    });
    expect(await lifecycle.resendPasswordReset()).toEqual({
      ok: false,
      errorType: 'missing_email',
    });

    // Request password reset error & resend password reset error scrub email PII
    vi.mocked(
      port.authClient!.requestPasswordResetEmail!
    ).mockRejectedValueOnce(
      new ApiError(429, 'Rate limit for pii@example.com')
    );
    expect(await lifecycle.requestPasswordReset('pii@example.com')).toEqual({
      ok: false,
      errorType: 'request_email',
    });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('pii@example.com');

    // Password forgot -> resend -> reset lifecycle without PII leakage
    const reqResetOk =
      await lifecycle.requestPasswordReset('forgot@example.com');
    expect(reqResetOk).toEqual({ ok: true });
    expect(lifecycle.getPendingPasswordResetEmail()).toBe('forgot@example.com');
    expect(port.navigate).toHaveBeenCalledWith('/auth/password-forgot-success');

    vi.mocked(
      port.authClient!.requestPasswordResetEmail!
    ).mockRejectedValueOnce(
      new ApiError(500, 'SMTP down for forgot@example.com')
    );
    expect(await lifecycle.resendPasswordReset()).toEqual({
      ok: false,
      errorType: 'resend_email',
    });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('forgot@example.com');

    const resendResetOk = await lifecycle.resendPasswordReset();
    expect(resendResetOk).toEqual({ ok: true });
    expect(port.toast).toHaveBeenCalledWith({
      title: '已成功重新發送',
      description: '請至您的電子郵箱查看。',
    });

    // withPort overrides + sanitizeAuthErrorMessage redacts raw userId, JWTs, and URL-encoded secrets
    const childNavigate = vi.fn();
    const scopedLifecycle = lifecycle.withPort({ navigate: childNavigate });
    await scopedLifecycle.requestPasswordReset('scoped@example.com');
    expect(childNavigate).toHaveBeenCalledWith('/auth/password-forgot-success');
    const runtimeJwt = buildTestJwt(
      { sub: '1234567890' },
      'c2lnbmF0dXJlMTIzNDU2'
    );
    expect(
      sanitizeAuthErrorMessage(
        `Failed user=987654 email=user%40example.com jwt=${runtimeJwt}`,
        [987654, 'user@example.com']
      )
    ).toBe('Failed user=[REDACTED] email=[REDACTED] jwt=[REDACTED]');

    vi.mocked(port.authClient!.resetPasswordWithToken!).mockRejectedValueOnce(
      new Error('Failed for token reset-secret-555 and NewPass1!')
    );
    const badReset = await lifecycle.completePasswordReset({
      verifyToken: 'reset-secret-555',
      password: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    });
    expect(badReset).toEqual({ ok: false, errorType: 'submit_new_password' });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('reset-secret-555');
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('NewPass1!');

    const completeOk = await lifecycle.completePasswordReset({
      verifyToken: 'reset-secret-555',
      password: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    });
    expect(completeOk).toEqual({ ok: true });
    expect(lifecycle.getPendingPasswordResetEmail()).toBeNull();
    expect(port.navigate).toHaveBeenCalledWith('/auth/password-reset-success');
  });

  it('supports handleGoogleOAuthCallback with initialPreExchanged without extra exchangeGoogleCode or getSession round-trips', async () => {
    const { port } = createFakePort();
    const lifecycle = createAuthLifecycle(port);

    await lifecycle.handleGoogleOAuthCallback({
      code: ' ',
      state: ' ',
      initialPreExchanged: {
        response: {
          code: '0',
          msg: 'ok',
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'pre_jwt', email: 'pre@example.com', user_id: 321 },
            user: fromPartial<ProfileVO>({
              user_id: 321,
              name: 'Pre User',
              onboarding: true,
              is_mentor: false,
            }),
          },
        },
        refreshBridgeToken: 'sealed_bridge_token',
      },
    });

    expect(port.exchangeGoogleCode).not.toHaveBeenCalled();
    expect(port.getSession).not.toHaveBeenCalled();
    expect(port.signIn).toHaveBeenCalledWith(
      'custom-google-token',
      expect.objectContaining({
        token: 'pre_jwt',
        refreshBridge: 'sealed_bridge_token',
      })
    );
    expect(port.navigate).toHaveBeenCalledWith('/mentor-pool');
  });

  it('fixes cross-account cache leak: both deleteAccountXC and Google OAuth delete_account atomically wipe favoriteMentorsReadModel, profileReadModel, and mentorFeedbackReadModel alongside all other stores', async () => {
    const seedAllClientCaches = () => {
      document.cookie = `${SESSION_HINT_COOKIE}=1||`;
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
      savePendingFavoriteMentor(505);
      notificationReadModel.setInitialData(
        'user-42',
        3,
        [fromAny({ id: 1, unread: true })],
        null
      );
      reservationReadModel.set(
        { userId: '42', state: 'MENTEE_UPCOMING' },
        { items: [fromPartial<Reservation>({ id: 'r1' })], next_dtend: 0 }
      );
      scheduleReadModel.set({ userId: '42', year: 2026, month: 11 }, [
        fromAny({ id: 1 }),
      ]);
      favoriteMentorsReadModel.seed('42', [fromAny({ user_id: 505 })]);
      profileReadModel.prime(
        { userId: 42, language: 'zh_TW' },
        fromAny({ user_id: 42, name: 'Stale Mentor' })
      );
      mentorFeedbackReadModel.set(
        { mentorId: 42, page: 1 },
        {
          items: [fromAny({ id: 'f1' })],
          totalRatingCount: 1,
          page: 1,
          pageSize: 10,
          ratingAverage: 5,
          completedMeetingCount: 1,
        }
      );
    };

    const expectAllClientCachesCleared = () => {
      expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
      expect(
        document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
      ).toBeNull();
      expect(getPendingFavoriteMentorId()).toBeNull();
      expect(
        notificationReadModel.getOrCreateState('user-42').unreadCountState
      ).toBe(0);
      expect(
        reservationReadModel.get({ userId: '42', state: 'MENTEE_UPCOMING' })
      ).toBeUndefined();
      expect(
        scheduleReadModel.get({ userId: '42', year: 2026, month: 11 })
      ).toBeUndefined();
      expect(favoriteMentorsReadModel.getSnapshot('42')).toBeUndefined();
      expect(
        profileReadModel.get({ userId: 42, language: 'zh_TW' })
      ).toBeUndefined();
      expect(
        mentorFeedbackReadModel.get({ mentorId: 42, page: 1 })
      ).toBeUndefined();
    };

    // 1. Disabled feature flag gate & blocked_reservations preservation
    const { port, storage } = createFakePort();
    const lifecycle = createAuthLifecycle(port);

    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';
    expect(
      await lifecycle.deleteAccountXC({
        email: 'a@example.com',
        password: 'Password1!',
      })
    ).toEqual({ status: 'disabled' });
    expect(
      await lifecycle.startDeleteAccountGoogleReauth('a@example.com')
    ).toEqual({ ok: false, errorType: 'disabled' });

    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = ' TRUE ';
    vi.mocked(port.authClient!.deleteAccount!).mockResolvedValueOnce({
      status: 'blocked_reservations',
    });
    expect(
      await lifecycle.deleteAccountXC({
        email: 'a@example.com',
        password: 'Password1!',
      })
    ).toEqual({ status: 'blocked_reservations' });
    expect(port.signOut).not.toHaveBeenCalled();

    vi.mocked(port.authClient!.deleteAccount!).mockResolvedValueOnce({
      status: 'error',
      message: 'Bad password Password1! for a@example.com',
    });
    expect(
      await lifecycle.deleteAccountXC({
        email: 'a@example.com',
        password: 'Password1!',
      })
    ).toEqual({
      status: 'error',
      message: 'Bad password Password1! for a@example.com',
    });
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('Password1!');
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('a@example.com');

    vi.mocked(port.authClient!.getGoogleAuthorizeUrl!).mockRejectedValueOnce(
      new ApiError(503, 'Down for reauth@example.com')
    );
    expect(
      await lifecycle.startDeleteAccountGoogleReauth('reauth@example.com')
    ).toEqual({ ok: false, errorType: '503' });
    expect(lifecycle.getPendingDeleteAccountEmail()).toBeNull();
    expect(
      JSON.stringify(vi.mocked(port.captureFailure).mock.calls)
    ).not.toContain('reauth@example.com');

    // 2. XC delete account success wipes all 7 client caches
    seedAllClientCaches();
    storage.setItem(PENDING_AUTH_CALLBACK_URL_KEY, '/mentor-pool');
    const xcSuccess = await lifecycle.deleteAccountXC({
      email: 'a@example.com',
      password: 'Password1!',
    });
    expect(xcSuccess).toEqual({ status: 'success' });
    expect(storage.dump()).toEqual({});
    expectAllClientCachesCleared();

    // 3. Google OAuth RESUME_DELETE_ACCOUNT success wipes all 7 client caches
    seedAllClientCaches();
    await lifecycle.startDeleteAccountGoogleReauth('del@example.com');
    expect(lifecycle.getPendingDeleteAccountEmail()).toBe('del@example.com');

    vi.mocked(port.exchangeGoogleCode).mockResolvedValueOnce(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          id_token: 'google_id_tok',
          auth: { token: 'tok_del', email: 'del@example.com' },
          user: fromPartial<ProfileVO>({ user_id: 42 }),
        },
      })
    );
    await lifecycle.handleGoogleOAuthCallback({
      code: 'oauth_code',
      state: 'oauth_state',
    });
    expect(storage.dump()).toEqual({});
    expectAllClientCachesCleared();

    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = originalCanDelete;
  });

  it('preserves static internal lifecycle logMessages for short invalid inputs, prevents [REDACTED] self-clobbering, and scrubs userId/user_id & Bearer tokens automatically', async () => {
    const { port } = createFakePort();
    const lifecycle = createAuthLifecycle(port);

    // (a) Short invalid credentials { email: 'a', password: 'i' } preserve 'Invalid fields!' intact
    const shortInvalidRes = await lifecycle.signInWithCredentials({
      email: 'a',
      password: 'i',
    });
    expect(shortInvalidRes).toEqual({
      ok: false,
      errorType: 'validate_credentials',
    });
    expect(port.captureFailure).toHaveBeenLastCalledWith({
      flow: 'sign_in',
      step: 'validate_credentials',
      level: 'info',
      message: 'Invalid fields!',
      errorCode: undefined,
    });

    // Even longer inputs matching words in static lifecycle logMessages never corrupt static messages
    await lifecycle.completePasswordReset({
      verifyToken: '',
      password: 'token',
      confirmPassword: 'token',
    });
    expect(port.captureFailure).toHaveBeenLastCalledWith({
      flow: 'password_reset',
      step: 'missing_token',
      level: 'info',
      message: 'Missing password reset verification token',
      errorCode: undefined,
    });

    // (b) Secrets containing 'R', 'EDAC', or 'REDACTED' never corrupt [REDACTED] markers
    expect(
      sanitizeAuthErrorMessage(
        'Failed for email=alice@example.com pass=R code=REDACTED frag=EDAC',
        ['alice@example.com', 'R', 'REDACTED', 'EDAC']
      )
    ).toBe(
      'Failed for email=[REDACTED] pass=R code=[REDACTED] frag=[REDACTED]'
    );
    expect(
      sanitizeAuthErrorMessage('Upstream [REDACTED] leaked secret=REDACTED', [
        'REDACTED',
      ])
    ).toBe('Upstream [REDACTED] leaked secret=[REDACTED]');

    // (c) Error strings containing user_id=987654, {"userId":987654}, and Bearer tok_123 get scrubbed automatically
    const scrubbed = sanitizeAuthErrorMessage(
      'Auth failed user_id=987654 payload={"userId":987654} header=Bearer tok_123'
    );
    expect(scrubbed).toBe(
      'Auth failed user_id=[REDACTED] payload={"userId":"[REDACTED]"} header=Bearer [REDACTED]'
    );
    expect(scrubbed).not.toContain('987654');
    expect(scrubbed).not.toContain('tok_123');
    expect(sanitizeAuthErrorMessage('{"userId":987654}')).toBe(
      '{"userId":"[REDACTED]"}'
    );
  });

  it('shares refresh_token_error single-flight deduplication across withPort() views while keeping separate createAuthLifecycle() instances isolated', async () => {
    let resolveSharedSignOut!: () => void;
    const sharedSignOut = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSharedSignOut = resolve;
        })
    );

    const { port } = createFakePort({ signOut: sharedSignOut });
    const lifecycle = createAuthLifecycle(port);
    const viewA = lifecycle.withPort({ navigate: vi.fn() });
    const viewB = lifecycle.withPort({ navigate: vi.fn() });

    const flightA = viewA.terminateSession('refresh_token_error');
    const flightB = viewB.terminateSession('refresh_token_error');

    // Separate createAuthLifecycle instance remains isolated and invokes its own signOut independently
    const isolatedPort = createFakePort();
    const isolatedLifecycle = createAuthLifecycle(isolatedPort.port);
    await isolatedLifecycle.terminateSession('refresh_token_error');
    expect(isolatedPort.port.signOut).toHaveBeenCalledTimes(1);

    expect(sharedSignOut).toHaveBeenCalledTimes(1);
    resolveSharedSignOut();
    await Promise.all([flightA, flightB]);
    expect(sharedSignOut).toHaveBeenCalledTimes(1);
  });

  it('scrubs email, password, and user_id PII inside mapSignUpFailure and captureFailure when signUpWithCredentials fails', async () => {
    const captureFailure = vi.fn();
    const { port } = createFakePort({
      captureFailure,
      authClient: {
        signUp: vi
          .fn()
          .mockRejectedValue(
            new ApiError(
              406,
              'Account (user@example.com, user_id=778899, SecretPass99!) already exists'
            )
          ),
      } as unknown as AuthLifecyclePort['authClient'],
    });
    const lifecycle = createAuthLifecycle(port);

    const result = await lifecycle.signUpWithCredentials({
      email: 'user@example.com',
      password: 'SecretPass99!',
      confirm_password: 'SecretPass99!',
    });

    expect(result).toEqual({ ok: false, errorType: '406' });
    expect(captureFailure).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(captureFailure.mock.calls[0]?.[0]);
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('778899');
    expect(logged).not.toContain('SecretPass99!');
  });
});

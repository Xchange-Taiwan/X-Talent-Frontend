import type { Session } from 'next-auth';

import {
  clearAnalyticsUser as defaultClearAnalyticsUser,
  resolveAnalyticsUserRole,
  setAnalyticsUserContext as defaultSetAnalyticsUserContext,
  trackEvent as defaultTrackEvent,
} from '@/lib/analytics';
import {
  clearAuthFlowStorage,
  clearPendingCallbackUrl,
  clearPendingDeleteAccountEmail,
  consumePendingCallbackUrl,
  getPendingDeleteAccountEmail,
  type SessionStorageLike,
  setPendingDeleteAccountEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/authFlowStorage';
import {
  type ClientSignInFn,
  type GoogleOAuthCodeExchanger,
  type OAuthInvalidErrorType,
  type OAuthOutcome,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import { clearSessionHint as defaultClearSessionHint } from '@/lib/auth/sessionHint';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure as defaultCaptureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import {
  EMAIL_VERIFY_HREF,
  FIND_MENTOR_HREF,
  HOME_HREF,
  ONBOARDING_HREF,
  RESERVATION_MENTEE_HREF,
  sanitizeCallbackUrl,
  SIGNIN_HREF,
} from '@/lib/routes';
import { SignInSchema } from '@/schemas/auth';
import { postBackendLogout } from '@/services/auth/backendLogout';
import {
  deleteAccount as defaultDeleteAccount,
  type DeleteAccountResult,
} from '@/services/auth/deleteAccount';
import { getGoogleAuthorizeLoginUrl } from '@/services/auth/googleAuthorize';
import { notificationStoreManager } from '@/stores/notificationStore';

export type SignInLifecycleStep =
  'validate_credentials' | 'authenticate' | 'get_session';

export class SignInLifecycleError extends Error {
  constructor(
    message: string,
    public readonly step: SignInLifecycleStep,
    public readonly logMessage: string,
    public readonly level: 'info' | 'warning' | 'error' = 'info',
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = 'SignInLifecycleError';
  }
}

export type SessionTeardownReason =
  | 'logout'
  | 'refresh_token_error'
  | 'delete_account_xc'
  | 'delete_account_google';

export type ClientSignOutFn = (options?: {
  callbackUrl?: string;
  redirect?: boolean;
}) => Promise<unknown>;

export type GetSessionFn = () => Promise<Session | null>;

export interface AuthToastPayload {
  variant?: 'default' | 'destructive';
  title?: string;
  description?: string;
  duration?: number;
}

export interface TerminateClientSessionAdapters {
  signOut: ClientSignOutFn;
  callbackUrl?: string;
  storage?: SessionStorageLike | null;
  revokeBackendSession?: () => Promise<unknown>;
  revalidateAfterDelete?: () => Promise<unknown>;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  clearNotifications?: () => void;
  clearReservations?: () => void;
  clearSchedules?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

function resolveDefaultTeardownCallbackUrl(
  reason: SessionTeardownReason
): string | undefined {
  switch (reason) {
    case 'logout':
      return undefined;
    case 'refresh_token_error':
      return SIGNIN_HREF;
    case 'delete_account_xc':
    case 'delete_account_google':
      return HOME_HREF;
  }
}

/**
 * Atomically tears down all client-side session artifacts across every sign-out
 * path (`logout`, `refresh_token_error`, `delete_account_xc`, `delete_account_google`):
 * 1. `sessionHint` cookie & DOM attributes (ADR-0001)
 * 2. GA4 / Clarity user context
 * 3. Pending auth `sessionStorage` keys (`authFlowStorage`)
 * 4. User-scoped in-memory stores (`notificationStoreManager`, `reservationReadModel`, `scheduleReadModel`)
 * 5. Reason-specific best-effort server cleanup (`postBackendLogout` or `revalidateAfterDelete`)
 * 6. NextAuth `signOut`
 */
export async function terminateClientSession(
  reason: SessionTeardownReason,
  adapters: TerminateClientSessionAdapters
): Promise<void> {
  const {
    signOut,
    callbackUrl,
    storage,
    revokeBackendSession = postBackendLogout,
    revalidateAfterDelete,
    clearSessionHint = defaultClearSessionHint,
    clearAnalyticsUser = defaultClearAnalyticsUser,
    clearNotifications = () => notificationStoreManager.clear(),
    clearReservations = () => reservationReadModel.clear(),
    clearSchedules = () => scheduleReadModel.clear(),
    captureFailure = defaultCaptureFlowFailure,
  } = adapters;

  clearSessionHint();
  clearAnalyticsUser();
  clearAuthFlowStorage(storage);
  clearNotifications();
  clearReservations();
  clearSchedules();

  if (reason === 'logout') {
    try {
      await revokeBackendSession();
    } catch {
      // Backend session revocation is best-effort; local sign-out must still complete.
    }
  } else if (
    (reason === 'delete_account_xc' || reason === 'delete_account_google') &&
    revalidateAfterDelete
  ) {
    try {
      await revalidateAfterDelete();
    } catch (error) {
      captureFailure({
        flow: 'delete_account',
        step: 'revalidate_dispatch',
        message: error instanceof Error ? error.message : String(error),
        level: 'warning',
      });
    }
  }

  const resolvedCallbackUrl =
    callbackUrl !== undefined
      ? callbackUrl
      : resolveDefaultTeardownCallbackUrl(reason);

  if (resolvedCallbackUrl !== undefined) {
    await signOut({ callbackUrl: resolvedCallbackUrl });
  } else {
    await signOut();
  }
}

interface PostLoginChoreographyOptions {
  method: 'Email' | 'Google';
  callbackUrlSource: 'search' | 'storage';
  search?: string;
  currentOrigin?: string;
  storage?: SessionStorageLike | null;
  fallbackIdentity?: {
    userId: string | null;
    isMentor: boolean;
  };
  getSession: GetSessionFn;
  navigate: (href: string) => void;
  setAnalyticsUserContext?: typeof defaultSetAnalyticsUserContext;
  trackEvent?: typeof defaultTrackEvent;
}

async function completePostLoginChoreography({
  method,
  callbackUrlSource,
  search,
  currentOrigin,
  storage,
  fallbackIdentity,
  getSession,
  navigate,
  setAnalyticsUserContext = defaultSetAnalyticsUserContext,
  trackEvent = defaultTrackEvent,
}: PostLoginChoreographyOptions): Promise<void> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw new SignInLifecycleError(
      'Login failed',
      'get_session',
      'No access token after login',
      'error'
    );
  }

  const resolvedUserId = session.user?.id ?? fallbackIdentity?.userId ?? null;
  const resolvedIsMentor = session.user?.isMentor ?? fallbackIdentity?.isMentor;
  const userRole = resolveAnalyticsUserRole({
    id: resolvedUserId,
    isMentor: resolvedIsMentor,
  });

  setAnalyticsUserContext({
    userId: resolvedUserId,
    userRole,
  });
  trackEvent({
    name: 'login',
    feature: 'auth',
    metadata: {
      method,
      user_role: userRole,
    },
  });

  let safeCallbackUrl: string | null = null;
  if (callbackUrlSource === 'search') {
    clearPendingCallbackUrl(storage);
    const rawCallbackUrl = search
      ? new URLSearchParams(search).get('callbackUrl')
      : null;
    safeCallbackUrl = sanitizeCallbackUrl(rawCallbackUrl, currentOrigin);
  } else {
    safeCallbackUrl = consumePendingCallbackUrl(currentOrigin, storage);
  }

  if (session.user?.onBoarding === false) {
    navigate(ONBOARDING_HREF);
  } else {
    navigate(safeCallbackUrl ?? FIND_MENTOR_HREF);
  }
}

export interface SignInWithCredentialsAdapters {
  signIn: ClientSignInFn;
  getSession: GetSessionFn;
  navigate: (href: string) => void;
  search?: string;
  currentOrigin?: string;
  storage?: SessionStorageLike | null;
  setAnalyticsUserContext?: typeof defaultSetAnalyticsUserContext;
  trackEvent?: typeof defaultTrackEvent;
}

export async function signInWithCredentials(
  values: unknown,
  adapters: SignInWithCredentialsAdapters
): Promise<void> {
  const parsed = SignInSchema.safeParse(values);
  if (!parsed.success) {
    throw new SignInLifecycleError(
      'Invalid fields!',
      'validate_credentials',
      'Invalid fields!',
      'info'
    );
  }

  const login = await adapters.signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  if (login?.error || login?.ok === false) {
    throw new SignInLifecycleError(
      'Invalid credentials!',
      'authenticate',
      'Invalid credentials',
      'info',
      login.error ?? undefined
    );
  }

  await completePostLoginChoreography({
    method: 'Email',
    callbackUrlSource: 'search',
    search: adapters.search,
    currentOrigin: adapters.currentOrigin,
    storage: adapters.storage,
    getSession: adapters.getSession,
    navigate: adapters.navigate,
    setAnalyticsUserContext: adapters.setAnalyticsUserContext,
    trackEvent: adapters.trackEvent,
  });
}

export interface ExecuteDeleteAccountXCAdapters {
  signOut: ClientSignOutFn;
  revalidateAfterDelete?: () => Promise<unknown>;
  deleteAccountFn?: typeof defaultDeleteAccount;
  storage?: SessionStorageLike | null;
  trackEvent?: typeof defaultTrackEvent;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  clearNotifications?: () => void;
  clearReservations?: () => void;
  clearSchedules?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

export async function executeDeleteAccountXC(
  credentials: { email: string; password: string },
  adapters: ExecuteDeleteAccountXCAdapters
): Promise<DeleteAccountResult> {
  const {
    deleteAccountFn = defaultDeleteAccount,
    trackEvent = defaultTrackEvent,
  } = adapters;

  const result = await deleteAccountFn({
    email: credentials.email,
    password: credentials.password,
  });

  if (result.status === 'success') {
    trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
    await terminateClientSession('delete_account_xc', {
      signOut: adapters.signOut,
      revalidateAfterDelete: adapters.revalidateAfterDelete,
      storage: adapters.storage,
      clearSessionHint: adapters.clearSessionHint,
      clearAnalyticsUser: adapters.clearAnalyticsUser,
      clearNotifications: adapters.clearNotifications,
      clearReservations: adapters.clearReservations,
      clearSchedules: adapters.clearSchedules,
      captureFailure: adapters.captureFailure,
    });
  }

  return result;
}

export interface InitiateGoogleDeleteReauthAdapters {
  navigate: (url: string) => void;
  storage?: SessionStorageLike | null;
  getAuthorizeUrl?: typeof getGoogleAuthorizeLoginUrl;
}

export async function initiateGoogleDeleteAccountReauth(
  email: string,
  adapters: InitiateGoogleDeleteReauthAdapters
): Promise<void> {
  const {
    navigate,
    storage,
    getAuthorizeUrl = getGoogleAuthorizeLoginUrl,
  } = adapters;

  setPendingDeleteAccountEmail(email, storage);
  try {
    const { authorization_url } = await getAuthorizeUrl();
    navigate(authorization_url);
  } catch (error) {
    clearPendingDeleteAccountEmail(storage);
    throw error;
  }
}

export interface ExecuteGoogleOAuthCallbackAdapters {
  exchangeCode: GoogleOAuthCodeExchanger;
  signIn: ClientSignInFn;
  signOut: ClientSignOutFn;
  getSession: GetSessionFn;
  navigate: (href: string) => void;
  onToast: (payload: AuthToastPayload) => void;
  revalidateAfterDelete?: () => Promise<unknown>;
  currentOrigin?: string;
  storage?: SessionStorageLike | null;
  deleteAccountFn?: typeof defaultDeleteAccount;
  resolveOutcomeFn?: typeof resolveOAuthOutcome;
  signInWithGoogleTokenFn?: typeof signInWithGoogleToken;
  setAnalyticsUserContext?: typeof defaultSetAnalyticsUserContext;
  trackEvent?: typeof defaultTrackEvent;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  clearNotifications?: () => void;
  clearReservations?: () => void;
  clearSchedules?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

function buildInvalidOAuthToast(
  errorType: OAuthInvalidErrorType
): AuthToastPayload {
  const description =
    errorType === 'MISSING_PARAMS'
      ? 'Authorization failed. Please try again.'
      : errorType === 'DELETE_FLOW_INVALID'
        ? '無法取得 Google 憑證，請稍後再試'
        : 'Something went wrong during login.';

  const title =
    errorType === 'MISSING_PARAMS'
      ? 'Missing Google OAuth parameters'
      : errorType === 'DELETE_FLOW_INVALID'
        ? '刪除帳號失敗'
        : 'Login failed';

  return {
    variant: 'destructive',
    title,
    description,
  };
}

export async function executeGoogleOAuthCallback(
  params: { code: string | null; state: string | null },
  adapters: ExecuteGoogleOAuthCallbackAdapters
): Promise<void> {
  const {
    exchangeCode,
    signIn,
    signOut,
    getSession,
    navigate,
    onToast,
    revalidateAfterDelete,
    currentOrigin,
    storage,
    deleteAccountFn = defaultDeleteAccount,
    resolveOutcomeFn = resolveOAuthOutcome,
    signInWithGoogleTokenFn = signInWithGoogleToken,
    setAnalyticsUserContext = defaultSetAnalyticsUserContext,
    trackEvent = defaultTrackEvent,
  } = adapters;

  const pendingDeleteAccountEmail = getPendingDeleteAccountEmail(storage);
  const outcome: OAuthOutcome = await resolveOutcomeFn(
    params.code,
    params.state,
    {
      exchangeCode,
      pendingDeleteAccountEmail,
    }
  );

  try {
    switch (outcome.type) {
      case 'INVALID': {
        clearPendingDeleteAccountEmail(storage);
        clearPendingCallbackUrl(storage);
        onToast(buildInvalidOAuthToast(outcome.errorType));
        navigate(SIGNIN_HREF);
        return;
      }

      case 'SIGNUP': {
        clearPendingCallbackUrl(storage);
        trackEvent({
          name: 'sign_up',
          feature: 'auth',
          metadata: {
            method: 'Google',
            user_role: 'guest',
          },
        });
        setPendingVerificationEmail(outcome.data.auth.email ?? '', storage);
        navigate(EMAIL_VERIFY_HREF);
        return;
      }

      case 'LOGIN': {
        if (!outcome.data.user || !outcome.data.auth.token) {
          clearPendingCallbackUrl(storage);
          onToast({
            variant: 'destructive',
            title: 'Missing login data',
            description: 'OAuth response is missing required fields.',
          });
          navigate(SIGNIN_HREF);
          return;
        }

        await signInWithGoogleTokenFn(
          signIn,
          outcome.data.auth.token,
          outcome.data.auth.email ?? '',
          outcome.data.user
        );

        await completePostLoginChoreography({
          method: 'Google',
          callbackUrlSource: 'storage',
          currentOrigin,
          storage,
          fallbackIdentity: {
            userId:
              outcome.data.user.user_id !== undefined
                ? String(outcome.data.user.user_id)
                : null,
            isMentor: Boolean(outcome.data.user.is_mentor),
          },
          getSession,
          navigate,
          setAnalyticsUserContext,
          trackEvent,
        });
        return;
      }

      case 'RESUME_DELETE_ACCOUNT': {
        clearPendingDeleteAccountEmail(storage);
        clearPendingCallbackUrl(storage);

        const { id_token, auth, user } = outcome.data;
        if (!id_token || !auth.token || !user) {
          onToast({
            variant: 'destructive',
            title: '刪除帳號失敗',
            description: '無法取得 Google 憑證，請稍後再試',
          });
          navigate(SIGNIN_HREF);
          return;
        }

        await signInWithGoogleTokenFn(
          signIn,
          auth.token,
          auth.email ?? '',
          user
        );

        const result = await deleteAccountFn({
          email: outcome.email,
          id_token,
        });

        if (result.status === 'success') {
          trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
          await terminateClientSession('delete_account_google', {
            signOut,
            revalidateAfterDelete,
            storage,
            clearSessionHint: adapters.clearSessionHint,
            clearAnalyticsUser: adapters.clearAnalyticsUser,
            clearNotifications: adapters.clearNotifications,
            clearReservations: adapters.clearReservations,
            clearSchedules: adapters.clearSchedules,
            captureFailure: adapters.captureFailure,
          });
          return;
        }

        if (result.status === 'blocked_reservations') {
          onToast({
            variant: 'destructive',
            title: '無法刪除帳號',
            description: '您目前有未完成或未來的預約，請先處理後再刪除帳號。',
          });
          navigate(RESERVATION_MENTEE_HREF);
          return;
        }

        onToast({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: result.message || '系統錯誤，請稍後再試',
        });
        navigate(SIGNIN_HREF);
        return;
      }
    }
  } catch {
    clearPendingCallbackUrl(storage);
    onToast({
      variant: 'destructive',
      title: 'Login failed',
      description: 'Something went wrong during login.',
    });
    navigate(SIGNIN_HREF);
  }
}

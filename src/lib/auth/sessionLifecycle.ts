import type { Session } from 'next-auth';

import {
  clearAnalyticsUser as defaultClearAnalyticsUser,
  resolveAnalyticsUserRole,
  setAnalyticsUserContext as defaultSetAnalyticsUserContext,
  trackEvent as defaultTrackEvent,
} from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import {
  clearAuthFlowStorage,
  clearPendingCallbackUrl,
  clearPendingDeleteAccountEmail,
  clearPendingPasswordResetEmail,
  clearPendingVerificationEmail,
  consumePendingCallbackUrl,
  getPendingDeleteAccountEmail,
  getPendingPasswordResetEmail,
  getPendingVerificationEmail,
  persistPendingCallbackUrlFromSearch,
  type SessionStorageLike,
  setPendingDeleteAccountEmail,
  setPendingPasswordResetEmail,
  setPendingVerificationEmail,
} from '@/lib/auth/authFlowStorage';
import {
  type ClientSignInFn,
  enrichGoogleLoginUserWithIdTokenFallback,
  type GoogleOAuthCodeExchanger,
  type OAuthCallbackResponse,
  type OAuthInvalidErrorType,
  type OAuthOutcome,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import { clearSessionHint as defaultClearSessionHint } from '@/lib/auth/sessionHint';
import { clearUserProfileDtoCache } from '@/lib/cache/userProfileDtoCache';
import { getErrorMessage } from '@/lib/errorUtils';
import {
  clearPendingFavoriteMentor,
  favoriteMentorsReadModel,
  getPendingFavoriteProfilePath,
} from '@/lib/favorites';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure as defaultCaptureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import {
  EMAIL_VERIFY_HREF,
  FIND_MENTOR_HREF,
  HOME_HREF,
  ONBOARDING_HREF,
  PASSWORD_FORGOT_SUCCESS_HREF,
  PASSWORD_RESET_SUCCESS_HREF,
  RESERVATION_MENTEE_HREF,
  sanitizeCallbackUrl,
  SIGNIN_HREF,
} from '@/lib/routes';
import { singleFlight } from '@/lib/singleFlight';
import { SignInSchema } from '@/schemas/auth';
import {
  authClient,
  type DeleteAccountDTO,
  type DeleteAccountResult,
  type GoogleAuthorizeVO,
  type ResetPasswordWithTokenInput,
  type SignUpInput,
} from '@/services/auth/authClient';
import { notificationStoreManager } from '@/stores/notificationStore';

const defaultSignUp = (input: SignUpInput): Promise<void> =>
  authClient.signUp(input);

const defaultConfirmSignUp = (token: string): Promise<void> =>
  authClient.confirmSignUp(token);

const defaultResendVerificationEmail = (email: string): Promise<void> =>
  authClient.resendVerificationEmail(email);

const defaultRequestPasswordResetEmail = (email: string): Promise<void> =>
  authClient.requestPasswordResetEmail(email);

const defaultResetPasswordWithToken = (
  input: ResetPasswordWithTokenInput
): Promise<void> => authClient.resetPasswordWithToken(input);

const defaultGetGoogleAuthorizeUrl = (
  intent: 'login' | 'signup'
): Promise<GoogleAuthorizeVO> => authClient.getGoogleAuthorizeUrl(intent);

const defaultDeleteAccount = (
  payload: DeleteAccountDTO
): Promise<DeleteAccountResult> => authClient.deleteAccount(payload);

const defaultPostBackendLogout = (): Promise<void> =>
  authClient.postBackendLogout();

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

export class SignUpLifecycleError extends Error {
  public readonly title: string;
  public readonly logMessage: string;
  public readonly level: 'info' | 'warning' | 'error';
  public readonly errorCode?: string;

  constructor(options: {
    title: string;
    description: string;
    logMessage: string;
    level?: 'info' | 'warning' | 'error';
    errorCode?: string;
  }) {
    super(options.description);
    this.name = 'SignUpLifecycleError';
    this.title = options.title;
    this.logMessage = options.logMessage;
    this.level = options.level ?? 'info';
    this.errorCode = options.errorCode;
  }
}

export type ConfirmSignUpLifecycleStep = 'missing_token' | 'confirm_token';

export class ConfirmSignUpLifecycleError extends Error {
  constructor(
    message: string,
    public readonly title: string,
    public readonly step: ConfirmSignUpLifecycleStep,
    public readonly logMessage: string,
    public readonly level: 'info' | 'warning' | 'error' = 'info',
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = 'ConfirmSignUpLifecycleError';
  }
}

export type PasswordResetLifecycleStep =
  | 'missing_email'
  | 'missing_token'
  | 'request_email'
  | 'resend_email'
  | 'submit_new_password';

export class PasswordResetLifecycleError extends Error {
  constructor(
    message: string,
    public readonly title: string,
    public readonly step: PasswordResetLifecycleStep,
    public readonly logMessage: string,
    public readonly level: 'info' | 'warning' | 'error' = 'info',
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = 'PasswordResetLifecycleError';
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
  clearFavorites?: () => void;
  clearProfileCache?: () => void;
  clearMentorFeedback?: () => void;
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

const inflightRefreshTeardown = new Map<'refresh_token_error', Promise<void>>();

async function executeTerminateClientSession(
  reason: SessionTeardownReason,
  adapters: TerminateClientSessionAdapters
): Promise<void> {
  const {
    signOut,
    callbackUrl,
    storage,
    revokeBackendSession = defaultPostBackendLogout,
    revalidateAfterDelete,
    clearSessionHint = defaultClearSessionHint,
    clearAnalyticsUser = defaultClearAnalyticsUser,
    clearNotifications = () => notificationStoreManager.clear(),
    clearReservations = () => reservationReadModel.clear(),
    clearSchedules = () => scheduleReadModel.clear(),
    clearFavorites = () => favoriteMentorsReadModel.clear(),
    clearProfileCache = () => clearUserProfileDtoCache(),
    clearMentorFeedback = () => mentorFeedbackReadModel.clear(),
    captureFailure = defaultCaptureFlowFailure,
  } = adapters;

  clearSessionHint();
  clearAnalyticsUser();
  clearAuthFlowStorage(storage);
  clearPendingFavoriteMentor();
  clearNotifications();
  clearReservations();
  clearSchedules();
  clearFavorites();
  clearProfileCache();
  clearMentorFeedback();

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

/**
 * Atomically tears down all client-side session artifacts across every sign-out
 * path (`logout`, `refresh_token_error`, `delete_account_xc`, `delete_account_google`):
 * 1. `sessionHint` cookie & DOM attributes (ADR-0001)
 * 2. GA4 / Clarity user context
 * 3. Pending auth `sessionStorage` keys (`authFlowStorage`) & pending favorite `localStorage` (`clearPendingFavoriteMentor`)
 * 4. User-scoped in-memory stores (`notificationStoreManager`, `reservationReadModel`, `scheduleReadModel`)
 * 5. Reason-specific best-effort server cleanup (`postBackendLogout` or `revalidateAfterDelete`)
 * 6. NextAuth `signOut`
 */
export async function terminateClientSession(
  reason: SessionTeardownReason,
  adapters: TerminateClientSessionAdapters
): Promise<void> {
  if (reason === 'refresh_token_error') {
    return singleFlight(inflightRefreshTeardown, 'refresh_token_error', () =>
      executeTerminateClientSession(reason, adapters)
    );
  }
  return executeTerminateClientSession(reason, adapters);
}

export interface ResolvePostAuthRedirectOptions {
  explicitCallbackUrl: string | null;
  isOnboarded: boolean;
  now?: number;
}

export function resolvePostAuthRedirect({
  explicitCallbackUrl,
  isOnboarded,
  now = Date.now(),
}: ResolvePostAuthRedirectOptions): string {
  const pendingFavoritePath = getPendingFavoriteProfilePath(now);

  if (explicitCallbackUrl && explicitCallbackUrl !== pendingFavoritePath) {
    clearPendingFavoriteMentor();
  }

  if (!isOnboarded) {
    return ONBOARDING_HREF;
  }

  return explicitCallbackUrl ?? pendingFavoritePath ?? FIND_MENTOR_HREF;
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

  navigate(
    resolvePostAuthRedirect({
      explicitCallbackUrl: safeCallbackUrl,
      isOnboarded:
        session.user?.onBoarding !== false || Boolean(session.user?.isMentor),
    })
  );
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

function buildSignUpLifecycleError(error: unknown): SignUpLifecycleError {
  const logMessage =
    error instanceof Error ? error.message : 'Unexpected sign-up error';

  if (error instanceof ApiError) {
    const errorCode = String(error.status);
    if (error.status === 422) {
      return new SignUpLifecycleError({
        title: '驗證失敗',
        description: error.message || '驗證錯誤。請確保所有欄位均正確填寫。',
        logMessage,
        errorCode,
      });
    }
    if (error.status === 406) {
      return new SignUpLifecycleError({
        title: '註冊失敗',
        description:
          error.message || '此電子郵件已被註冊。請使用其他電子郵件或登錄。',
        logMessage,
        errorCode,
      });
    }
    if (error.status === 429) {
      return new SignUpLifecycleError({
        title: '請求過於頻繁',
        description: error.message || '您已超出最大註冊嘗試次數。請稍後再試。',
        logMessage,
        errorCode,
      });
    }
    return new SignUpLifecycleError({
      title: '註冊失敗',
      description: `${error.message || '發生錯誤。'} - HTTP狀態碼: ${error.status}。`,
      logMessage,
      errorCode,
    });
  }

  return new SignUpLifecycleError({
    title: '註冊失敗',
    description:
      error instanceof Error ? error.message : '系統錯誤，請稍後再試',
    logMessage,
  });
}

export interface SignUpWithCredentialsAdapters {
  navigate: (href: string) => void;
  signUpFn?: typeof defaultSignUp;
  storage?: SessionStorageLike | null;
  trackEvent?: typeof defaultTrackEvent;
}

export async function signUpWithCredentials(
  values: SignUpInput,
  adapters: SignUpWithCredentialsAdapters
): Promise<void> {
  const {
    navigate,
    signUpFn = defaultSignUp,
    storage,
    trackEvent = defaultTrackEvent,
  } = adapters;

  try {
    await signUpFn(values);
  } catch (error) {
    throw buildSignUpLifecycleError(error);
  }

  trackEvent({
    name: 'sign_up',
    feature: 'auth',
    metadata: {
      method: 'Email',
      user_role: 'guest',
    },
  });
  setPendingVerificationEmail(values.email, storage);
  navigate(EMAIL_VERIFY_HREF);
}

export type GoogleAuthIntent = 'login' | 'signup' | 'delete_account_reauth';

export type InitiateGoogleAuthParams =
  | {
      intent: 'login';
      search?: string;
      currentOrigin?: string;
    }
  | {
      intent: 'signup';
    }
  | {
      intent: 'delete_account_reauth';
      email: string;
    };

export interface InitiateGoogleAuthAdapters {
  navigate: (url: string) => void;
  storage?: SessionStorageLike | null;
  getAuthorizeUrl?: typeof defaultGetGoogleAuthorizeUrl;
}

export async function initiateGoogleAuth(
  params: InitiateGoogleAuthParams,
  adapters: InitiateGoogleAuthAdapters
): Promise<void> {
  const {
    navigate,
    storage,
    getAuthorizeUrl = defaultGetGoogleAuthorizeUrl,
  } = adapters;

  if (params.intent === 'delete_account_reauth') {
    clearPendingCallbackUrl(storage);
    setPendingDeleteAccountEmail(params.email, storage);
    try {
      const { authorization_url } = await getAuthorizeUrl('login');
      navigate(authorization_url);
    } catch (error) {
      clearPendingDeleteAccountEmail(storage);
      throw error;
    }
    return;
  }

  clearPendingDeleteAccountEmail(storage);

  if (params.intent === 'login') {
    try {
      const { authorization_url } = await getAuthorizeUrl('login');
      persistPendingCallbackUrlFromSearch(
        params.search ?? '',
        params.currentOrigin,
        storage
      );
      navigate(authorization_url);
    } catch (error) {
      clearPendingCallbackUrl(storage);
      throw error;
    }
    return;
  }

  try {
    const { authorization_url } = await getAuthorizeUrl('signup');
    clearPendingCallbackUrl(storage);
    navigate(authorization_url);
  } catch (error) {
    clearPendingCallbackUrl(storage);
    throw error;
  }
}

export interface ConfirmSignUpTokenAdapters {
  confirmSignUpFn?: typeof defaultConfirmSignUp;
  storage?: SessionStorageLike | null;
}

export async function confirmSignUpToken(
  token: string | null,
  adapters: ConfirmSignUpTokenAdapters = {}
): Promise<void> {
  const { confirmSignUpFn = defaultConfirmSignUp, storage } = adapters;

  if (!token) {
    throw new ConfirmSignUpLifecycleError(
      '缺少驗證 Token，請重新申請驗證信。',
      '驗證失敗',
      'missing_token',
      'Missing signup confirmation token',
      'info'
    );
  }

  try {
    await confirmSignUpFn(token);
  } catch (error) {
    throw new ConfirmSignUpLifecycleError(
      error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
      '註冊失敗',
      'confirm_token',
      error instanceof Error ? error.message : 'Failed to confirm signup token',
      'info',
      error instanceof ApiError ? String(error.status) : undefined
    );
  }

  clearPendingVerificationEmail(storage);
}

export interface ResendVerificationEmailAdapters {
  email?: string | null;
  resendVerificationEmailFn?: typeof defaultResendVerificationEmail;
  storage?: SessionStorageLike | null;
}

export async function resendVerificationEmailForPendingUser(
  adapters: ResendVerificationEmailAdapters = {}
): Promise<void> {
  const {
    email,
    resendVerificationEmailFn = defaultResendVerificationEmail,
    storage,
  } = adapters;

  const targetEmail = email || getPendingVerificationEmail(storage);
  if (!targetEmail) {
    throw new Error('找不到待驗證的電子郵件地址，請重新註冊。');
  }

  await resendVerificationEmailFn(targetEmail);
}

export interface RequestPasswordResetAdapters {
  navigate: (href: string) => void;
  requestPasswordResetEmailFn?: typeof defaultRequestPasswordResetEmail;
  storage?: SessionStorageLike | null;
}

export async function requestPasswordReset(
  email: string,
  adapters: RequestPasswordResetAdapters
): Promise<void> {
  const {
    navigate,
    requestPasswordResetEmailFn = defaultRequestPasswordResetEmail,
    storage,
  } = adapters;

  try {
    await requestPasswordResetEmailFn(email);
  } catch (error) {
    const message = getErrorMessage(error);
    throw new PasswordResetLifecycleError(
      message,
      '信件寄送失敗',
      'request_email',
      error instanceof Error
        ? error.message
        : 'Failed to request password reset email',
      'info',
      error instanceof ApiError ? String(error.status) : undefined
    );
  }

  setPendingPasswordResetEmail(email, storage);
  navigate(PASSWORD_FORGOT_SUCCESS_HREF);
}

export interface ResendPasswordResetAdapters {
  email?: string | null;
  requestPasswordResetEmailFn?: typeof defaultRequestPasswordResetEmail;
  storage?: SessionStorageLike | null;
}

export async function resendPasswordReset(
  adapters: ResendPasswordResetAdapters = {}
): Promise<void> {
  const {
    email,
    requestPasswordResetEmailFn = defaultRequestPasswordResetEmail,
    storage,
  } = adapters;

  const targetEmail = email || getPendingPasswordResetEmail(storage);
  if (!targetEmail) {
    throw new PasswordResetLifecycleError(
      '找不到您的電子郵件地址，請嘗試重新操作。',
      '發送失敗',
      'missing_email',
      'Missing pending password reset email',
      'info'
    );
  }

  try {
    await requestPasswordResetEmailFn(targetEmail);
  } catch (error) {
    const message = getErrorMessage(error);
    throw new PasswordResetLifecycleError(
      message,
      '信件寄送失敗',
      'resend_email',
      error instanceof Error
        ? error.message
        : 'Failed to resend password reset email',
      'info',
      error instanceof ApiError ? String(error.status) : undefined
    );
  }
}

export interface CompletePasswordResetInput {
  verifyToken: string | null;
  password: string;
  confirmPassword: string;
}

export interface CompletePasswordResetAdapters {
  navigate: (href: string) => void;
  resetPasswordWithTokenFn?: typeof defaultResetPasswordWithToken;
  storage?: SessionStorageLike | null;
}

export async function completePasswordReset(
  input: CompletePasswordResetInput,
  adapters: CompletePasswordResetAdapters
): Promise<void> {
  const {
    navigate,
    resetPasswordWithTokenFn = defaultResetPasswordWithToken,
    storage,
  } = adapters;

  if (!input.verifyToken) {
    throw new PasswordResetLifecycleError(
      '缺少驗證 Token，請重新申請密碼重設。',
      '驗證失敗',
      'missing_token',
      'Missing password reset verification token',
      'info'
    );
  }

  try {
    await resetPasswordWithTokenFn({
      verifyToken: input.verifyToken,
      password: input.password,
      confirmPassword: input.confirmPassword,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    throw new PasswordResetLifecycleError(
      message,
      '密碼重設失敗',
      'submit_new_password',
      message,
      'info',
      error instanceof ApiError ? String(error.status) : undefined
    );
  }

  clearPendingPasswordResetEmail(storage);
  navigate(PASSWORD_RESET_SUCCESS_HREF);
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
  const { deleteAccountFn = defaultDeleteAccount } = adapters;

  const result = await deleteAccountFn({
    email: credentials.email,
    password: credentials.password,
  });

  if (result.status === 'success') {
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
  params: {
    code: string | null;
    state: string | null;
    preExchanged?: OAuthCallbackResponse | null;
  },
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
      preExchanged: params.preExchanged,
    }
  );

  try {
    switch (outcome.type) {
      case 'INVALID': {
        clearPendingDeleteAccountEmail(storage);
        clearPendingCallbackUrl(storage);
        trackEvent({
          name: 'auth_flow_failed',
          feature: 'auth',
          metadata: {
            flow: 'oauth_google',
            error_type: outcome.errorType,
          },
        });
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
          trackEvent({
            name: 'auth_flow_failed',
            feature: 'auth',
            metadata: {
              flow: 'oauth_google',
              error_type: 'missing_login_data',
            },
          });
          onToast({
            variant: 'destructive',
            title: 'Missing login data',
            description: 'OAuth response is missing required fields.',
          });
          navigate(SIGNIN_HREF);
          return;
        }

        const enrichedUser = enrichGoogleLoginUserWithIdTokenFallback(
          outcome.data.user,
          outcome.data.id_token
        );

        await signInWithGoogleTokenFn(
          signIn,
          outcome.data.auth.token,
          outcome.data.auth.email ?? '',
          enrichedUser
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

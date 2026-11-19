import type { Session } from 'next-auth';

import {
  clearAnalyticsUser as defaultClearAnalyticsUser,
  resolveAnalyticsUserRole,
  setAnalyticsUserContext as defaultSetAnalyticsUserContext,
  trackEvent as defaultTrackEvent,
} from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import {
  AUTH_FLOW_STORAGE_KEYS,
  createAuthFlowStore,
  createInMemorySessionStorage,
  type InMemorySessionStorage,
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
  PENDING_PASSWORD_RESET_EMAIL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
  type SessionStorageLike,
} from '@/lib/auth/authFlowStorage';
import { type BffUserPayload, normalizeBffAuthUser } from '@/lib/auth/bffAuth';
import { clearSessionHint as defaultClearSessionHint } from '@/lib/auth/sessionHint';
import { getErrorMessage } from '@/lib/errorUtils';
import {
  clearPendingFavoriteMentor,
  favoriteMentorsReadModel,
  getPendingFavoriteProfilePath,
} from '@/lib/favorites';
import { isAccountDeletionEnabled } from '@/lib/featureFlags';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import {
  captureFlowFailure as defaultCaptureFlowFailure,
  sanitize,
} from '@/lib/monitoring';
import { notificationReadModel } from '@/lib/notifications';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import {
  EMAIL_VERIFY_HREF,
  FIND_MENTOR_HREF,
  hasCompletedOnboarding,
  HOME_HREF,
  isMentorOnboardingCallbackUrl,
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
  type AuthClient,
  authClient as defaultAuthClient,
  type DeleteAccountDTO,
  type DeleteAccountResult,
  type GoogleAuthorizeVO,
  type ResetPasswordWithTokenInput,
  type SignUpInput,
} from '@/services/auth/authClient';
import type { components } from '@/types/api';

export {
  AUTH_FLOW_STORAGE_KEYS,
  createInMemorySessionStorage,
  type InMemorySessionStorage,
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
  PENDING_PASSWORD_RESET_EMAIL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
  type SessionStorageLike,
};

export type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
export type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];
type ProfileVO = components['schemas']['ProfileVO'];

export type OAuthInvalidErrorType =
  | 'MISSING_PARAMS'
  | 'CALLBACK_FAILED'
  | 'DELETE_FLOW_INVALID'
  | 'missing_login_data';

export type ValidatedLoginCallbackVO = GoogleCallbackVO & {
  auth: GoogleCallbackVO['auth'] & { token: string };
  user: ProfileVO;
};

export type ValidatedDeleteCallbackVO = GoogleCallbackVO & {
  auth: GoogleCallbackVO['auth'] & { token: string };
  id_token: string;
  user: ProfileVO;
};

export type OAuthOutcome =
  | { type: 'LOGIN'; data: ValidatedLoginCallbackVO }
  | { type: 'SIGNUP'; data: GoogleCallbackVO }
  | {
      type: 'RESUME_DELETE_ACCOUNT';
      data: ValidatedDeleteCallbackVO;
      email: string;
    }
  | {
      type: 'INVALID';
      errorType: OAuthInvalidErrorType;
    };

export interface ClientSignInResult {
  error?: string | null;
  ok?: boolean;
}

export type ClientSignInFn = (
  provider: string,
  options?: Record<string, unknown>
) => Promise<ClientSignInResult | undefined>;

export type GoogleOAuthCodeExchanger = (
  code: string,
  state: string
) => Promise<OAuthCallbackResponse>;

export interface PreExchangedGoogleOAuthResult {
  response: OAuthCallbackResponse;
  refreshBridgeToken: string | null;
}

export interface ResolveOAuthOutcomeOptions {
  exchangeCode: GoogleOAuthCodeExchanger;
  pendingDeleteAccountEmail?: string | null;
  preExchanged?: OAuthCallbackResponse | null;
}

export interface GoogleProfileFallback {
  name?: string;
  avatar?: string;
}

const GOOGLE_AVATAR_HOST = 'lh3.googleusercontent.com';
const GOOGLE_AVATAR_ORIGIN = `https://${GOOGLE_AVATAR_HOST}`;
const ALLOWED_S3_AVATAR_HOSTS = new Set([
  'x-career-multimedia.s3.ap-northeast-1.amazonaws.com',
  'x-career-multimedia.s3.amazonaws.com',
]);
const MAX_ONBOARDING_NAME_CODE_UNITS = 20;
const MAX_GOOGLE_AVATAR_URL_LENGTH = 2048;
const GOOGLE_FIFE_SUFFIX_REGEX = /=[^/=]+$/;

const MIN_SECRET_REDACTION_LENGTH = 4;
const REDACTED_MARKER = '[REDACTED]';
const EMAIL_PII_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT_PII_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER_TOKEN_PII_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const USER_ID_JSON_PII_PATTERN =
  /("user[_-]?id"\s*:\s*)(?:"(?:[^"\\]|\\.)*"|[^\s,}\]]+)/gi;
const USER_ID_KEY_VALUE_PII_PATTERN =
  /(\buser[_-]?id\b\s*[:=]\s*)(?:\[REDACTED\]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,&;})'"\]]+)/gi;

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPercentEncodedPattern(encoded: string): string {
  return escapeRegExp(encoded).replace(
    /%([0-9A-Fa-f])([0-9A-Fa-f])/g,
    (_match, h1: string, h2: string) => {
      const p1 = /[A-Za-z]/.test(h1)
        ? `[${h1.toUpperCase()}${h1.toLowerCase()}]`
        : h1;
      const p2 = /[A-Za-z]/.test(h2)
        ? `[${h2.toUpperCase()}${h2.toLowerCase()}]`
        : h2;
      return `%${p1}${p2}`;
    }
  );
}

/**
 * Strips known per-call PII secrets (email, raw tokens, passwords, user IDs)
 * plus generic email/JWT/Bearer/userId/query/JSON patterns before forwarding
 * messages to Sentry.
 */
export function sanitizeAuthErrorMessage(
  rawMessage: string,
  secretsToRedact: readonly (string | number | null | undefined)[] = []
): string {
  let message = rawMessage
    .replace(BEARER_TOKEN_PII_PATTERN, `Bearer ${REDACTED_MARKER}`)
    .replace(EMAIL_PII_PATTERN, REDACTED_MARKER)
    .replace(JWT_PII_PATTERN, REDACTED_MARKER)
    .replace(USER_ID_JSON_PII_PATTERN, `$1"${REDACTED_MARKER}"`)
    .replace(USER_ID_KEY_VALUE_PII_PATTERN, `$1${REDACTED_MARKER}`);

  const patternEntries = new Map<string, number>();
  for (const candidate of secretsToRedact) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (!text) continue;
    if (text.length < MIN_SECRET_REDACTION_LENGTH && !text.includes('@')) {
      continue;
    }

    const escapedRaw = escapeRegExp(text);
    patternEntries.set(
      escapedRaw,
      Math.max(patternEntries.get(escapedRaw) ?? 0, text.length)
    );

    const encoded = encodeURIComponent(text);
    if (encoded !== text) {
      const encodedPattern = toPercentEncodedPattern(encoded);
      patternEntries.set(
        encodedPattern,
        Math.max(patternEntries.get(encodedPattern) ?? 0, encoded.length)
      );
    }
  }

  if (patternEntries.size > 0) {
    const escapedRedacted = escapeRegExp(REDACTED_MARKER);
    patternEntries.set(
      escapedRedacted,
      Math.max(patternEntries.get(escapedRedacted) ?? 0, REDACTED_MARKER.length)
    );

    const orderedPatterns = Array.from(patternEntries.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pattern]) => pattern);

    message = message.replace(
      new RegExp(orderedPatterns.join('|'), 'g'),
      REDACTED_MARKER
    );
  }

  return sanitize(message) ?? message;
}

/**
 * Clamps a display name to at most `maxCodeUnits` UTF-16 code units (matching
 * `step1Schema`'s `.max(20)`) by iterating full Unicode code points so
 * surrogate pairs (emojis or CJK Extension B characters) are never split.
 */
export function clampOnboardingName(
  rawName: unknown,
  maxCodeUnits = MAX_ONBOARDING_NAME_CODE_UNITS
): string | undefined {
  if (typeof rawName !== 'string') return undefined;
  const trimmed = rawName.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= maxCodeUnits) return trimmed;

  let acc = '';
  for (const codePoint of trimmed) {
    if (acc.length + codePoint.length > maxCodeUnits) {
      break;
    }
    acc += codePoint;
  }
  const result = acc.trimEnd();
  return result || undefined;
}

/**
 * Normalizes a Google User Content avatar URL to `=s512-c` high resolution,
 * matching backend `normalize_google_avatar` (`https://lh3.googleusercontent.com/...`).
 */
export function normalizeGoogleAvatarUrl(
  rawAvatarUrl: unknown
): string | undefined {
  if (typeof rawAvatarUrl !== 'string') return undefined;
  const trimmed = rawAvatarUrl.trim();
  if (!trimmed || trimmed.length > MAX_GOOGLE_AVATAR_URL_LENGTH) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.origin !== GOOGLE_AVATAR_ORIGIN ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return undefined;
    }

    const cleanPathname = parsed.pathname.replace(/\/+$/, '');
    if (cleanPathname.length <= 1) {
      return undefined;
    }

    parsed.pathname = GOOGLE_FIFE_SUFFIX_REGEX.test(cleanPathname)
      ? cleanPathname.replace(GOOGLE_FIFE_SUFFIX_REGEX, '=s512-c')
      : `${cleanPathname}=s512-c`;

    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Normalizes a prefill avatar URL: Google `lh3.googleusercontent.com` URLs must
 * pass strict `=s512-c` normalization; other avatar URLs must belong to the
 * configured S3 `images.remotePatterns` allowlist over default-port HTTPS.
 */
export function sanitizePrefillAvatarUrl(
  rawAvatarUrl: unknown
): string | undefined {
  if (typeof rawAvatarUrl !== 'string') return undefined;
  const trimmed = rawAvatarUrl.trim();
  if (!trimmed || trimmed.length > MAX_GOOGLE_AVATAR_URL_LENGTH) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== 'https:' ||
      parsed.port !== '' ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return undefined;
    }
    if (parsed.hostname === GOOGLE_AVATAR_HOST) {
      return normalizeGoogleAvatarUrl(trimmed);
    }
    if (!ALLOWED_S3_AVATAR_HOSTS.has(parsed.hostname)) {
      return undefined;
    }
    const cleanPathname = parsed.pathname.replace(/\/+$/, '');
    return cleanPathname.length > 1 ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function decodeBase64UrlUtf8(segment: string): string | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(segment)) {
    return null;
  }
  try {
    const stripped = segment.replace(/=+$/g, '');
    if (stripped.length % 4 === 1) {
      return null;
    }
    const base64 = stripped.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Extracts UTF-8 `name` (clamped to onboarding's 20-code-unit limit, with
 * `given_name`/`family_name` fallback) and high-res `=s512-c` `avatar` from
 * the Google `id_token` returned by `POST /v2/oauth/google/callback`.
 */
export function extractGoogleIdTokenProfileFallback(
  idToken: string | null | undefined
): GoogleProfileFallback {
  if (!idToken || typeof idToken !== 'string') return {};
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[1]) return {};

  const decoded = decodeBase64UrlUtf8(parts[1]);
  if (!decoded) return {};

  try {
    const payload: unknown = JSON.parse(decoded);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    const claims = payload as Record<string, unknown>;

    const givenName =
      typeof claims.given_name === 'string' ? claims.given_name.trim() : '';
    const familyName =
      typeof claims.family_name === 'string' ? claims.family_name.trim() : '';
    const composedName = [givenName, familyName].filter(Boolean).join(' ');

    const name =
      clampOnboardingName(claims.name) ?? clampOnboardingName(composedName);
    const avatar = normalizeGoogleAvatarUrl(claims.picture);

    return {
      ...(name !== undefined ? { name } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Backfills missing `name` and `avatar` (upgraded to `=s512-c`) from Google's
 * `id_token` ONLY when the account has not completed onboarding yet
 * (`user.onboarding === false`).
 */
export function enrichGoogleLoginUserWithIdTokenFallback<
  T extends Record<string, unknown>,
>(user: T, idToken?: string | null): T {
  if (user.onboarding !== false) {
    return user;
  }

  const fallback = extractGoogleIdTokenProfileFallback(idToken);
  const existingName = clampOnboardingName(user.name);
  const existingAvatar = sanitizePrefillAvatarUrl(user.avatar);

  const resolvedName = existingName ?? fallback.name;
  const resolvedAvatar = existingAvatar ?? fallback.avatar;

  if (resolvedName === user.name && resolvedAvatar === user.avatar) {
    return user;
  }

  return {
    ...user,
    ...(resolvedName !== undefined ? { name: resolvedName } : {}),
    ...(resolvedAvatar !== undefined ? { avatar: resolvedAvatar } : {}),
  };
}

/**
 * Signs in with NextAuth `custom-google-token` provider via injected client
 * `signIn` adapter (keeping `src/lib/auth` free of `next-auth/react` imports).
 */
export async function signInWithGoogleToken(
  signIn: ClientSignInFn,
  token: string,
  email: string,
  user: Record<string, unknown>,
  refreshBridgeToken?: string | null
): Promise<void> {
  const res = await signIn('custom-google-token', {
    redirect: false,
    token,
    email,
    user: JSON.stringify(user),
    ...(refreshBridgeToken ? { refreshBridge: refreshBridgeToken } : {}),
  });

  if (res?.error) {
    throw new Error(res.error);
  }
}

/**
 * Synthesizes a client `Session` from a server-pre-exchanged Google OAuth
 * LOGIN payload via `normalizeBffAuthUser` so post-login choreography avoids
 * an extra blocking `/api/auth/session` round-trip.
 */
export function synthesizePreExchangedSession(
  preExchanged: PreExchangedGoogleOAuthResult
): Session | null {
  const callbackData = preExchanged.response.data;
  if (
    !callbackData ||
    callbackData.auth_type !== 'LOGIN' ||
    !callbackData.auth.token ||
    !callbackData.user
  ) {
    return null;
  }

  const enrichedUser = enrichGoogleLoginUserWithIdTokenFallback(
    callbackData.user as unknown as Record<string, unknown>,
    callbackData.id_token
  ) as unknown as BffUserPayload;

  const normalizedUser = normalizeBffAuthUser({
    token: callbackData.auth.token,
    email: callbackData.auth.email ?? null,
    user: enrichedUser,
  });

  return {
    accessToken: callbackData.auth.token,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: normalizedUser.id,
      email: normalizedUser.email,
      name: normalizedUser.name,
      avatar: normalizedUser.avatar,
      avatarUpdatedAt: normalizedUser.avatarUpdatedAt,
      onBoarding: normalizedUser.onBoarding,
      isMentor: normalizedUser.isMentor,
      jobTitle: normalizedUser.jobTitle,
      company: normalizedUser.company,
      personalLinks: normalizedUser.personalLinks,
    },
  };
}

function normalizeOAuthOutcome(
  raw:
    | OAuthOutcome
    | { type: 'LOGIN'; data: GoogleCallbackVO }
    | {
        type: 'RESUME_DELETE_ACCOUNT';
        data: GoogleCallbackVO;
        email: string;
      }
): OAuthOutcome {
  if (raw.type === 'LOGIN') {
    if (!raw.data?.user || !raw.data?.auth?.token) {
      return { type: 'INVALID', errorType: 'missing_login_data' };
    }
    return {
      type: 'LOGIN',
      data: raw.data as ValidatedLoginCallbackVO,
    };
  }

  if (raw.type === 'RESUME_DELETE_ACCOUNT') {
    if (!raw.data?.id_token || !raw.data?.auth?.token || !raw.data?.user) {
      return { type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' };
    }
    return {
      type: 'RESUME_DELETE_ACCOUNT',
      data: raw.data as ValidatedDeleteCallbackVO,
      email: raw.email,
    };
  }

  return raw;
}

/**
 * Resolves and validates the state machine outcome of a Google OAuth callback
 * in a single pass so callers never need secondary `!user` or `!id_token` checks.
 */
export async function resolveOAuthOutcome(
  code: string | null,
  state: string | null,
  options: ResolveOAuthOutcomeOptions
): Promise<OAuthOutcome> {
  const cleanCode = code?.trim() || null;
  const cleanState = state?.trim() || null;
  const hasPreExchanged =
    options.preExchanged !== undefined && options.preExchanged !== null;

  if (!hasPreExchanged && (!cleanCode || !cleanState)) {
    return { type: 'INVALID', errorType: 'MISSING_PARAMS' };
  }

  try {
    const res = hasPreExchanged
      ? options.preExchanged!
      : await options.exchangeCode(cleanCode!, cleanState!);
    const callbackData = res?.data;

    if (!callbackData) {
      return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
    }

    if (options.pendingDeleteAccountEmail) {
      if (callbackData.auth_type === 'LOGIN') {
        return normalizeOAuthOutcome({
          type: 'RESUME_DELETE_ACCOUNT',
          data: callbackData,
          email: options.pendingDeleteAccountEmail,
        });
      }
      return { type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' };
    }

    if (callbackData.auth_type === 'SIGNUP') {
      return { type: 'SIGNUP', data: callbackData };
    }

    return normalizeOAuthOutcome({ type: 'LOGIN', data: callbackData });
  } catch {
    return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
  }
}

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

export interface ResolvePostAuthRedirectOptions {
  explicitCallbackUrl: string | null;
  isOnboarded: boolean;
  userId?: string | null;
  now?: number;
}

export function resolvePostAuthRedirect({
  explicitCallbackUrl,
  isOnboarded,
  userId,
  now = Date.now(),
}: ResolvePostAuthRedirectOptions): string {
  const pendingFavoritePath = getPendingFavoriteProfilePath(now);

  if (explicitCallbackUrl && explicitCallbackUrl !== pendingFavoritePath) {
    clearPendingFavoriteMentor();
  }

  if (
    !isOnboarded &&
    !isMentorOnboardingCallbackUrl(explicitCallbackUrl, userId)
  ) {
    return ONBOARDING_HREF;
  }

  return explicitCallbackUrl ?? pendingFavoritePath ?? FIND_MENTOR_HREF;
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

function buildInvalidOAuthToast(errorType: string): AuthToastPayload {
  if (errorType === 'MISSING_PARAMS') {
    return {
      variant: 'destructive',
      title: 'Missing Google OAuth parameters',
      description: 'Authorization failed. Please try again.',
    };
  }
  if (errorType === 'DELETE_FLOW_INVALID') {
    return {
      variant: 'destructive',
      title: '刪除帳號失敗',
      description: '無法取得 Google 憑證，請稍後再試',
    };
  }
  if (errorType === 'missing_login_data') {
    return {
      variant: 'destructive',
      title: 'Missing login data',
      description: 'OAuth response is missing required fields.',
    };
  }
  return {
    variant: 'destructive',
    title: 'Login failed',
    description: 'Something went wrong during login.',
  };
}

function clearAllClientReadModels(): void {
  clearPendingFavoriteMentor();
  notificationReadModel.clear();
  reservationReadModel.clear();
  scheduleReadModel.clear();
  favoriteMentorsReadModel.clear();
  profileReadModel.clear();
  mentorFeedbackReadModel.clear();
}

export interface AuthLifecyclePort {
  authClient?: Partial<AuthClient>;
  signIn?: ClientSignInFn;
  signOut?: ClientSignOutFn;
  getSession?: GetSessionFn;
  exchangeGoogleCode?: GoogleOAuthCodeExchanger;
  revalidateAfterDelete?: () => Promise<unknown>;
  navigate?: (href: string) => void;
  toast?: (payload: AuthToastPayload) => void;
  storage?: SessionStorageLike | null;
  trackEvent?: typeof defaultTrackEvent;
  setAnalyticsUserContext?: typeof defaultSetAnalyticsUserContext;
  clearAnalyticsUser?: typeof defaultClearAnalyticsUser;
  captureFailure?: typeof defaultCaptureFlowFailure;
  getSearch?: () => string;
  getOrigin?: () => string | undefined;
  now?: () => number;
}

export type AuthActionResult = { ok: true } | { ok: false; errorType?: string };

export type ConfirmSignUpResult =
  { ok: true; status: 'success' } | { ok: false; status: 'failure' | 'stale' };

export type DeleteAccountLifecycleResult =
  DeleteAccountResult | { status: 'disabled' };

export type StartGoogleAuthInput =
  | {
      isSignIn: boolean;
      search?: string;
      currentOrigin?: string;
    }
  | {
      intent: 'login' | 'signup';
      search?: string;
      currentOrigin?: string;
    };

export interface HandleGoogleOAuthCallbackInput {
  code: string | null;
  state: string | null;
  initialPreExchanged?: PreExchangedGoogleOAuthResult | null;
  preExchanged?: OAuthCallbackResponse | null;
}

export interface CompletePasswordResetInput {
  verifyToken: string | null;
  password: string;
  confirmPassword: string;
}

export interface TerminateSessionOptions extends Partial<AuthLifecyclePort> {
  callbackUrl?: string;
}

export interface ConfirmSignUpOptions extends Partial<AuthLifecyclePort> {
  isCurrent?: () => boolean;
}

export interface AuthLifecycle {
  withPort(overrides: Partial<AuthLifecyclePort>): AuthLifecycle;
  signInWithCredentials(
    values: unknown,
    overrides?: Partial<AuthLifecyclePort> & {
      search?: string;
      currentOrigin?: string;
    }
  ): Promise<AuthActionResult>;
  trackSignUpStarted(overrides?: Partial<AuthLifecyclePort>): void;
  signUpWithCredentials(
    values: SignUpInput,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  startGoogleAuth(
    input: StartGoogleAuthInput,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  handleGoogleOAuthCallback(
    params: HandleGoogleOAuthCallbackInput,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<void>;
  confirmSignUp(
    token: string | null,
    options?: ConfirmSignUpOptions
  ): Promise<ConfirmSignUpResult>;
  getPendingVerificationEmail(
    overrides?: Partial<AuthLifecyclePort>
  ): string | null;
  resendVerificationEmail(
    email?: string | null,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  requestPasswordReset(
    email: string,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  getPendingPasswordResetEmail(
    overrides?: Partial<AuthLifecyclePort>
  ): string | null;
  resendPasswordReset(
    email?: string | null,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  completePasswordReset(
    input: CompletePasswordResetInput,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  deleteAccountXC(
    credentials: { email: string; password: string },
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<DeleteAccountLifecycleResult>;
  startDeleteAccountGoogleReauth(
    email: string,
    overrides?: Partial<AuthLifecyclePort>
  ): Promise<AuthActionResult>;
  getPendingDeleteAccountEmail(
    overrides?: Partial<AuthLifecyclePort>
  ): string | null;
  terminateSession(
    reason: SessionTeardownReason,
    options?: TerminateSessionOptions
  ): Promise<void>;
}

interface ResolvedAuthPort {
  authClient: AuthClient;
  signIn?: ClientSignInFn;
  signOut?: ClientSignOutFn;
  getSession?: GetSessionFn;
  exchangeGoogleCode?: GoogleOAuthCodeExchanger;
  revalidateAfterDelete?: () => Promise<unknown>;
  navigate: (href: string) => void;
  toast: (payload: AuthToastPayload) => void;
  storage: SessionStorageLike | null | undefined;
  trackEvent: typeof defaultTrackEvent;
  setAnalyticsUserContext: typeof defaultSetAnalyticsUserContext;
  clearAnalyticsUser: typeof defaultClearAnalyticsUser;
  captureFailure: typeof defaultCaptureFlowFailure;
  getSearch: () => string;
  getOrigin: () => string | undefined;
  now: () => number;
}

function defaultBrowserNavigate(href: string): void {
  if (typeof window !== 'undefined') {
    window.location.assign(href);
  }
}

function defaultGetSearch(): string {
  return typeof window !== 'undefined' ? window.location.search : '';
}

function defaultGetOrigin(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined;
}

function noopToast(): void {}

const fallbackTrackEvent: typeof defaultTrackEvent = (...args) =>
  defaultTrackEvent(...args);
const fallbackSetAnalyticsUserContext: typeof defaultSetAnalyticsUserContext = (
  ...args
) => defaultSetAnalyticsUserContext(...args);
const fallbackClearAnalyticsUser: typeof defaultClearAnalyticsUser = () =>
  defaultClearAnalyticsUser();
const fallbackCaptureFailure: typeof defaultCaptureFlowFailure = (...args) =>
  defaultCaptureFlowFailure(...args);

interface InternalTerminateExtra {
  callbackUrl?: string;
  revokeBackendSession?: () => Promise<unknown>;
  clearSessionHint?: () => void;
}

interface InternalOAuthExtra {
  resolveOutcomeFn?: typeof resolveOAuthOutcome;
  signInWithGoogleTokenFn?: typeof signInWithGoogleToken;
  clearSessionHint?: () => void;
  currentOrigin?: string;
}

interface InternalAuthLifecycle extends AuthLifecycle {
  signInWithCredentialsRaw(
    values: unknown,
    overrides: Partial<AuthLifecyclePort> & {
      search?: string;
      currentOrigin?: string;
    }
  ): Promise<void>;
  signUpWithCredentialsRaw(
    values: SignUpInput,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  initiateGoogleAuthRaw(
    params: InitiateGoogleAuthParams,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  confirmSignUpTokenRaw(
    token: string | null,
    overrides: Partial<AuthLifecyclePort>,
    shouldCommit?: () => boolean
  ): Promise<void>;
  resendVerificationEmailRaw(
    email: string | null | undefined,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  requestPasswordResetRaw(
    email: string,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  resendPasswordResetRaw(
    email: string | null | undefined,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  completePasswordResetRaw(
    input: CompletePasswordResetInput,
    overrides: Partial<AuthLifecyclePort>
  ): Promise<void>;
  executeDeleteAccountXCRaw(
    credentials: { email: string; password: string },
    overrides: Partial<AuthLifecyclePort> & InternalTerminateExtra
  ): Promise<DeleteAccountResult>;
  handleGoogleOAuthCallbackInternal(
    params: HandleGoogleOAuthCallbackInput,
    overrides?: Partial<AuthLifecyclePort>,
    extra?: InternalOAuthExtra
  ): Promise<void>;
  terminateSessionInternal(
    reason: SessionTeardownReason,
    options?: TerminateSessionOptions,
    extra?: InternalTerminateExtra
  ): Promise<void>;
}

type RefreshTeardownFlightMap = Map<'refresh_token_error', Promise<void>>;

function isStaticPasswordResetStep(step: PasswordResetLifecycleStep): boolean {
  return step === 'missing_email' || step === 'missing_token';
}

function createAuthLifecycleInternal(
  basePort: AuthLifecyclePort = {},
  sharedInflightRefreshTeardown?: RefreshTeardownFlightMap
): InternalAuthLifecycle {
  const inflightRefreshTeardown: RefreshTeardownFlightMap =
    sharedInflightRefreshTeardown ?? new Map();
  const flowStore = createAuthFlowStore(basePort.storage);

  const resolvePort = (
    overrides?: Partial<AuthLifecyclePort>
  ): ResolvedAuthPort => {
    const mergedClient: AuthClient = {
      signUp:
        overrides?.authClient?.signUp ??
        basePort.authClient?.signUp ??
        ((input) => defaultAuthClient.signUp(input)),
      confirmSignUp:
        overrides?.authClient?.confirmSignUp ??
        basePort.authClient?.confirmSignUp ??
        ((token) => defaultAuthClient.confirmSignUp(token)),
      resendVerificationEmail:
        overrides?.authClient?.resendVerificationEmail ??
        basePort.authClient?.resendVerificationEmail ??
        ((email) => defaultAuthClient.resendVerificationEmail(email)),
      requestPasswordResetEmail:
        overrides?.authClient?.requestPasswordResetEmail ??
        basePort.authClient?.requestPasswordResetEmail ??
        ((email) => defaultAuthClient.requestPasswordResetEmail(email)),
      resetPasswordWithToken:
        overrides?.authClient?.resetPasswordWithToken ??
        basePort.authClient?.resetPasswordWithToken ??
        ((input) => defaultAuthClient.resetPasswordWithToken(input)),
      getGoogleAuthorizeUrl:
        overrides?.authClient?.getGoogleAuthorizeUrl ??
        basePort.authClient?.getGoogleAuthorizeUrl ??
        ((intent) => defaultAuthClient.getGoogleAuthorizeUrl(intent)),
      deleteAccount:
        overrides?.authClient?.deleteAccount ??
        basePort.authClient?.deleteAccount ??
        ((payload) => defaultAuthClient.deleteAccount(payload)),
      postBackendLogout:
        overrides?.authClient?.postBackendLogout ??
        basePort.authClient?.postBackendLogout ??
        (() => defaultAuthClient.postBackendLogout()),
    };

    const resolvedStorage =
      overrides && 'storage' in overrides
        ? overrides.storage
        : basePort.storage;

    return {
      authClient: mergedClient,
      signIn: overrides?.signIn ?? basePort.signIn,
      signOut: overrides?.signOut ?? basePort.signOut,
      getSession: overrides?.getSession ?? basePort.getSession,
      exchangeGoogleCode:
        overrides?.exchangeGoogleCode ?? basePort.exchangeGoogleCode,
      revalidateAfterDelete:
        overrides?.revalidateAfterDelete ?? basePort.revalidateAfterDelete,
      navigate:
        overrides?.navigate ?? basePort.navigate ?? defaultBrowserNavigate,
      toast: overrides?.toast ?? basePort.toast ?? noopToast,
      storage: resolvedStorage,
      trackEvent:
        overrides?.trackEvent ?? basePort.trackEvent ?? fallbackTrackEvent,
      setAnalyticsUserContext:
        overrides?.setAnalyticsUserContext ??
        basePort.setAnalyticsUserContext ??
        fallbackSetAnalyticsUserContext,
      clearAnalyticsUser:
        overrides?.clearAnalyticsUser ??
        basePort.clearAnalyticsUser ??
        fallbackClearAnalyticsUser,
      captureFailure:
        overrides?.captureFailure ??
        basePort.captureFailure ??
        fallbackCaptureFailure,
      getSearch: overrides?.getSearch ?? basePort.getSearch ?? defaultGetSearch,
      getOrigin: overrides?.getOrigin ?? basePort.getOrigin ?? defaultGetOrigin,
      now: overrides?.now ?? basePort.now ?? Date.now,
    };
  };

  const completePostLoginChoreography = async (options: {
    method: 'Email' | 'Google';
    callbackUrlSource: 'search' | 'storage';
    search?: string;
    currentOrigin?: string;
    fallbackIdentity?: {
      userId: string | null;
      isMentor: boolean;
    };
    resolved: ResolvedAuthPort;
    getSessionOverride?: GetSessionFn;
  }): Promise<void> => {
    const {
      method,
      callbackUrlSource,
      search,
      currentOrigin,
      fallbackIdentity,
      resolved,
      getSessionOverride,
    } = options;

    const getSessionFn = getSessionOverride ?? resolved.getSession;
    if (!getSessionFn) {
      throw new Error('AuthLifecyclePort.getSession is required for sign-in.');
    }

    const session = await getSessionFn();
    if (!session?.accessToken) {
      throw new SignInLifecycleError(
        'Login failed',
        'get_session',
        'No access token after login',
        'error'
      );
    }

    const resolvedUserId = session.user?.id ?? fallbackIdentity?.userId ?? null;
    const resolvedIsMentor =
      session.user?.isMentor ?? fallbackIdentity?.isMentor;
    const userRole = resolveAnalyticsUserRole({
      id: resolvedUserId,
      isMentor: resolvedIsMentor,
    });

    resolved.setAnalyticsUserContext({
      userId: resolvedUserId,
      userRole,
    });
    resolved.trackEvent({
      name: 'login',
      feature: 'auth',
      metadata: {
        method,
        user_role: userRole,
      },
    });

    const origin = currentOrigin ?? resolved.getOrigin();
    let safeCallbackUrl: string | null = null;
    if (callbackUrlSource === 'search') {
      flowStore.clearCallbackUrl(resolved.storage);
      const effectiveSearch = search ?? resolved.getSearch();
      const rawCallbackUrl = effectiveSearch
        ? new URLSearchParams(effectiveSearch).get('callbackUrl')
        : null;
      safeCallbackUrl = sanitizeCallbackUrl(rawCallbackUrl, origin);
    } else {
      safeCallbackUrl = flowStore.consumeCallbackUrl(origin, resolved.storage);
    }

    resolved.navigate(
      resolvePostAuthRedirect({
        explicitCallbackUrl: safeCallbackUrl,
        isOnboarded: hasCompletedOnboarding(session.user),
        userId: resolvedUserId,
        now: resolved.now(),
      })
    );
  };

  const executeTerminate = async (
    reason: SessionTeardownReason,
    options?: TerminateSessionOptions,
    extra?: InternalTerminateExtra
  ): Promise<void> => {
    const resolved = resolvePort(options);
    if (!resolved.signOut) {
      throw new Error(
        'AuthLifecyclePort.signOut is required to terminate a client session.'
      );
    }

    const clearHint = extra?.clearSessionHint ?? defaultClearSessionHint;
    const revokeBackend =
      extra?.revokeBackendSession ??
      (() => resolved.authClient.postBackendLogout());

    clearHint();
    resolved.clearAnalyticsUser();
    flowStore.clearAll(resolved.storage);
    clearAllClientReadModels();

    if (reason === 'logout') {
      try {
        await revokeBackend();
      } catch {
        // Backend session revocation is best-effort; local sign-out must still complete.
      }
    } else if (
      (reason === 'delete_account_xc' || reason === 'delete_account_google') &&
      resolved.revalidateAfterDelete
    ) {
      try {
        await resolved.revalidateAfterDelete();
      } catch (error) {
        const rawMsg = error instanceof Error ? error.message : String(error);
        void resolved.captureFailure({
          flow: 'delete_account',
          step: 'revalidate_dispatch',
          message: sanitizeAuthErrorMessage(rawMsg),
          level: 'warning',
        });
      }
    }

    const explicitCallbackUrl = extra?.callbackUrl ?? options?.callbackUrl;
    const resolvedCallbackUrl =
      explicitCallbackUrl !== undefined
        ? explicitCallbackUrl
        : resolveDefaultTeardownCallbackUrl(reason);

    if (resolvedCallbackUrl !== undefined) {
      await resolved.signOut({ callbackUrl: resolvedCallbackUrl });
    } else {
      await resolved.signOut();
    }
  };

  const terminateSessionInternal = async (
    reason: SessionTeardownReason,
    options?: TerminateSessionOptions,
    extra?: InternalTerminateExtra
  ): Promise<void> => {
    if (reason === 'refresh_token_error') {
      return singleFlight(inflightRefreshTeardown, 'refresh_token_error', () =>
        executeTerminate(reason, options, extra)
      );
    }
    return executeTerminate(reason, options, extra);
  };

  const signInWithCredentialsRaw = async (
    values: unknown,
    overrides: Partial<AuthLifecyclePort> & {
      search?: string;
      currentOrigin?: string;
    } = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);
    const parsed = SignInSchema.safeParse(values);
    if (!parsed.success) {
      throw new SignInLifecycleError(
        'Invalid fields!',
        'validate_credentials',
        'Invalid fields!',
        'info'
      );
    }

    if (!resolved.signIn) {
      throw new Error('AuthLifecyclePort.signIn is required for sign-in.');
    }

    const login = await resolved.signIn('credentials', {
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
      search: overrides.search,
      currentOrigin: overrides.currentOrigin,
      resolved,
    });
  };

  const signUpWithCredentialsRaw = async (
    values: SignUpInput,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);
    try {
      await resolved.authClient.signUp(values);
    } catch (error) {
      throw buildSignUpLifecycleError(error);
    }

    resolved.trackEvent({
      name: 'sign_up',
      feature: 'auth',
      metadata: {
        method: 'Email',
        user_role: 'guest',
      },
    });
    flowStore.setVerificationEmail(values.email, resolved.storage);
    resolved.navigate(EMAIL_VERIFY_HREF);
  };

  const initiateGoogleAuthRaw = async (
    params: InitiateGoogleAuthParams,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);

    if (params.intent === 'delete_account_reauth') {
      flowStore.clearCallbackUrl(resolved.storage);
      flowStore.setDeleteAccountEmail(params.email, resolved.storage);
      try {
        const { authorization_url } =
          await resolved.authClient.getGoogleAuthorizeUrl('login');
        resolved.navigate(authorization_url);
      } catch (error) {
        flowStore.clearDeleteAccountEmail(resolved.storage);
        throw error;
      }
      return;
    }

    flowStore.clearDeleteAccountEmail(resolved.storage);

    if (params.intent === 'login') {
      try {
        const { authorization_url } =
          await resolved.authClient.getGoogleAuthorizeUrl('login');
        flowStore.persistCallbackUrlFromSearch(
          params.search ?? resolved.getSearch(),
          params.currentOrigin ?? resolved.getOrigin(),
          resolved.storage
        );
        resolved.navigate(authorization_url);
      } catch (error) {
        flowStore.clearCallbackUrl(resolved.storage);
        throw error;
      }
      return;
    }

    try {
      const { authorization_url } =
        await resolved.authClient.getGoogleAuthorizeUrl('signup');
      flowStore.clearCallbackUrl(resolved.storage);
      resolved.navigate(authorization_url);
    } catch (error) {
      flowStore.clearCallbackUrl(resolved.storage);
      throw error;
    }
  };

  const confirmSignUpTokenRaw = async (
    token: string | null,
    overrides: Partial<AuthLifecyclePort> = {},
    shouldCommit: () => boolean = () => true
  ): Promise<void> => {
    const resolved = resolvePort(overrides);

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
      await resolved.authClient.confirmSignUp(token);
    } catch (error) {
      throw new ConfirmSignUpLifecycleError(
        error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
        '註冊失敗',
        'confirm_token',
        error instanceof Error
          ? error.message
          : 'Failed to confirm signup token',
        'info',
        error instanceof ApiError ? String(error.status) : undefined
      );
    }

    if (shouldCommit()) {
      flowStore.clearVerificationEmail(resolved.storage);
    }
  };

  const resendVerificationEmailRaw = async (
    email: string | null | undefined,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);
    const targetEmail =
      email || flowStore.getVerificationEmail(resolved.storage);
    if (!targetEmail) {
      throw new Error('找不到待驗證的電子郵件地址，請重新註冊。');
    }

    await resolved.authClient.resendVerificationEmail(targetEmail);
  };

  const requestPasswordResetRaw = async (
    email: string,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);

    try {
      await resolved.authClient.requestPasswordResetEmail(email);
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

    flowStore.setPasswordResetEmail(email, resolved.storage);
    resolved.navigate(PASSWORD_FORGOT_SUCCESS_HREF);
  };

  const resendPasswordResetRaw = async (
    email: string | null | undefined,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);
    const targetEmail =
      email || flowStore.getPasswordResetEmail(resolved.storage);
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
      await resolved.authClient.requestPasswordResetEmail(targetEmail);
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
  };

  const completePasswordResetRaw = async (
    input: CompletePasswordResetInput,
    overrides: Partial<AuthLifecyclePort> = {}
  ): Promise<void> => {
    const resolved = resolvePort(overrides);

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
      await resolved.authClient.resetPasswordWithToken({
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

    flowStore.clearPasswordResetEmail(resolved.storage);
    resolved.navigate(PASSWORD_RESET_SUCCESS_HREF);
  };

  const executeDeleteAccountXCRaw = async (
    credentials: { email: string; password: string },
    overrides: Partial<AuthLifecyclePort> & InternalTerminateExtra = {}
  ): Promise<DeleteAccountResult> => {
    const resolved = resolvePort(overrides);
    const result = await resolved.authClient.deleteAccount({
      email: credentials.email,
      password: credentials.password,
    });

    if (result.status === 'success') {
      await terminateSessionInternal('delete_account_xc', overrides, {
        clearSessionHint: overrides.clearSessionHint,
      });
    }

    return result;
  };

  const handleGoogleOAuthCallbackInternal = async (
    params: HandleGoogleOAuthCallbackInput,
    overrides?: Partial<AuthLifecyclePort>,
    extra?: InternalOAuthExtra
  ): Promise<void> => {
    const resolved = resolvePort(overrides);
    const hasServerPreExchange =
      params.initialPreExchanged !== undefined &&
      params.initialPreExchanged !== null;
    const effectivePreExchanged = hasServerPreExchange
      ? params.initialPreExchanged!.response
      : params.preExchanged;

    const exchangeCode: GoogleOAuthCodeExchanger = hasServerPreExchange
      ? async () => params.initialPreExchanged!.response
      : (resolved.exchangeGoogleCode ??
        (async () => {
          throw new Error(
            'AuthLifecyclePort.exchangeGoogleCode is required for Google OAuth callbacks.'
          );
        }));

    const resolveOutcome = extra?.resolveOutcomeFn ?? resolveOAuthOutcome;
    const signInWithToken =
      extra?.signInWithGoogleTokenFn ??
      ((clientSignIn, token, email, user) =>
        signInWithGoogleToken(
          clientSignIn,
          token,
          email,
          user,
          hasServerPreExchange
            ? params.initialPreExchanged!.refreshBridgeToken
            : undefined
        ));

    const effectiveGetSession: GetSessionFn | undefined = hasServerPreExchange
      ? async () =>
          synthesizePreExchangedSession(params.initialPreExchanged!) ??
          (resolved.getSession ? await resolved.getSession() : null)
      : resolved.getSession;

    const pendingDeleteAccountEmail = flowStore.getDeleteAccountEmail(
      resolved.storage
    );

    const rawOutcome = await resolveOutcome(params.code, params.state, {
      exchangeCode,
      pendingDeleteAccountEmail,
      preExchanged: effectivePreExchanged,
    });
    const outcome = normalizeOAuthOutcome(rawOutcome);

    try {
      switch (outcome.type) {
        case 'INVALID': {
          flowStore.clearDeleteAccountEmail(resolved.storage);
          flowStore.clearCallbackUrl(resolved.storage);
          resolved.trackEvent({
            name: 'auth_flow_failed',
            feature: 'auth',
            metadata: {
              flow: 'oauth_google',
              error_type: outcome.errorType,
            },
          });
          resolved.toast(buildInvalidOAuthToast(outcome.errorType));
          resolved.navigate(SIGNIN_HREF);
          return;
        }

        case 'SIGNUP': {
          flowStore.clearCallbackUrl(resolved.storage);
          resolved.trackEvent({
            name: 'sign_up',
            feature: 'auth',
            metadata: {
              method: 'Google',
              user_role: 'guest',
            },
          });
          flowStore.setVerificationEmail(
            outcome.data.auth.email ?? '',
            resolved.storage
          );
          resolved.navigate(EMAIL_VERIFY_HREF);
          return;
        }

        case 'LOGIN': {
          if (!resolved.signIn) {
            throw new Error(
              'AuthLifecyclePort.signIn is required for Google OAuth login.'
            );
          }

          const enrichedUser = enrichGoogleLoginUserWithIdTokenFallback(
            outcome.data.user as unknown as Record<string, unknown>,
            outcome.data.id_token
          );

          await signInWithToken(
            resolved.signIn,
            outcome.data.auth.token,
            outcome.data.auth.email ?? '',
            enrichedUser
          );

          await completePostLoginChoreography({
            method: 'Google',
            callbackUrlSource: 'storage',
            currentOrigin: extra?.currentOrigin,
            fallbackIdentity: {
              userId:
                outcome.data.user.user_id !== undefined
                  ? String(outcome.data.user.user_id)
                  : null,
              isMentor: Boolean(outcome.data.user.is_mentor),
            },
            resolved,
            getSessionOverride: effectiveGetSession,
          });
          return;
        }

        case 'RESUME_DELETE_ACCOUNT': {
          flowStore.clearDeleteAccountEmail(resolved.storage);
          flowStore.clearCallbackUrl(resolved.storage);

          if (!resolved.signIn) {
            throw new Error(
              'AuthLifecyclePort.signIn is required for Google OAuth reauth.'
            );
          }

          const { id_token, auth, user } = outcome.data;
          await signInWithToken(
            resolved.signIn,
            auth.token,
            auth.email ?? '',
            user as unknown as Record<string, unknown>
          );

          const result = await resolved.authClient.deleteAccount({
            email: outcome.email,
            id_token,
          });

          if (result.status === 'success') {
            await terminateSessionInternal('delete_account_google', overrides, {
              clearSessionHint: extra?.clearSessionHint,
            });
            return;
          }

          if (result.status === 'blocked_reservations') {
            resolved.toast({
              variant: 'destructive',
              title: '無法刪除帳號',
              description: '您目前有未完成或未來的預約，請先處理後再刪除帳號。',
            });
            resolved.navigate(RESERVATION_MENTEE_HREF);
            return;
          }

          resolved.toast({
            variant: 'destructive',
            title: '刪除帳號失敗',
            description: result.message || '系統錯誤，請稍後再試',
          });
          resolved.navigate(SIGNIN_HREF);
          return;
        }
      }
    } catch {
      flowStore.clearCallbackUrl(resolved.storage);
      resolved.toast({
        variant: 'destructive',
        title: 'Login failed',
        description: 'Something went wrong during login.',
      });
      resolved.navigate(SIGNIN_HREF);
    }
  };

  return {
    withPort(overrides) {
      return createAuthLifecycleInternal(
        {
          ...basePort,
          ...overrides,
          authClient: {
            ...basePort.authClient,
            ...overrides.authClient,
          },
        },
        inflightRefreshTeardown
      );
    },

    async signInWithCredentials(values, overrides) {
      const resolved = resolvePort(overrides);
      const candidateSecrets: (string | undefined)[] = [];
      if (values && typeof values === 'object') {
        const record = values as Record<string, unknown>;
        if (typeof record.email === 'string') {
          candidateSecrets.push(record.email);
        }
        if (typeof record.password === 'string') {
          candidateSecrets.push(record.password);
        }
      }

      try {
        await signInWithCredentialsRaw(values, overrides);
        return { ok: true };
      } catch (err) {
        const isLifecycle = err instanceof SignInLifecycleError;
        const step = isLifecycle ? err.step : 'unexpected';
        const level = isLifecycle ? err.level : 'error';
        const rawLogMessage = isLifecycle
          ? err.logMessage
          : err instanceof Error
            ? err.message
            : 'Unexpected sign-in error';
        const isStaticStep =
          isLifecycle &&
          (err.step === 'validate_credentials' ||
            err.step === 'authenticate' ||
            err.step === 'get_session');
        const errorCode = isLifecycle ? err.errorCode : undefined;
        const userMessage = isLifecycle ? err.message : 'Something went wrong!';
        const duration = isLifecycle ? 1000 : 5000;

        resolved.trackEvent({
          name: 'auth_flow_failed',
          feature: 'auth',
          metadata: {
            flow: 'login',
            error_type: step,
          },
        });
        void resolved.captureFailure({
          flow: 'sign_in',
          step,
          level,
          message: isStaticStep
            ? sanitizeAuthErrorMessage(rawLogMessage)
            : sanitizeAuthErrorMessage(rawLogMessage, candidateSecrets),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          description: userMessage,
          duration,
        });
        return { ok: false, errorType: step };
      }
    },

    trackSignUpStarted(overrides) {
      const resolved = resolvePort(overrides);
      resolved.trackEvent({ name: 'sign_up_started', feature: 'auth' });
    },

    async signUpWithCredentials(values, overrides) {
      const resolved = resolvePort(overrides);
      try {
        await signUpWithCredentialsRaw(values, overrides);
        return { ok: true };
      } catch (err) {
        const mapped =
          err instanceof SignUpLifecycleError
            ? err
            : buildSignUpLifecycleError(err);
        const errorType =
          mapped.errorCode !== undefined
            ? String(mapped.errorCode)
            : 'submit_failed';

        resolved.trackEvent({
          name: 'auth_flow_failed',
          feature: 'auth',
          metadata: {
            flow: 'sign_up',
            error_type: errorType,
          },
        });
        void resolved.captureFailure({
          flow: 'sign_up',
          step: 'submit',
          level: mapped.level,
          message: sanitizeAuthErrorMessage(mapped.logMessage, [
            values.email,
            values.password,
            values.confirm_password,
          ]),
          errorCode: mapped.errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: mapped.title,
          description: mapped.message,
          duration: 5000,
        });
        return { ok: false, errorType };
      }
    },

    async startGoogleAuth(input, overrides) {
      const resolved = resolvePort(overrides);
      const isSignIn =
        'isSignIn' in input ? input.isSignIn : input.intent === 'login';

      resolved.trackEvent({
        name: 'auth_oauth_started',
        feature: 'auth',
        metadata: {
          method: 'Google',
          flow: isSignIn ? 'login' : 'sign_up',
        },
      });

      try {
        await initiateGoogleAuthRaw(
          isSignIn
            ? {
                intent: 'login',
                search: input.search,
                currentOrigin: input.currentOrigin,
              }
            : { intent: 'signup' },
          overrides
        );
        return { ok: true };
      } catch (err) {
        const errorCode =
          err instanceof ApiError ? String(err.status) : undefined;
        const rawMsg =
          err instanceof Error ? err.message : 'Google OAuth authorize failed';

        void resolved.captureFailure({
          flow: 'google_oauth',
          step: isSignIn ? 'authorize_login' : 'authorize_signup',
          level: 'warning',
          message: sanitizeAuthErrorMessage(rawMsg),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: isSignIn ? '登入失敗' : '註冊失敗',
          description: isSignIn
            ? '無法完成 Google 登入，請稍後再試。'
            : '無法完成 Google 註冊，請稍後再試。',
          duration: 5000,
        });
        return { ok: false, errorType: errorCode ?? 'authorize_failed' };
      }
    },

    async handleGoogleOAuthCallback(params, overrides) {
      await handleGoogleOAuthCallbackInternal(params, overrides);
    },

    async confirmSignUp(token, options) {
      const resolved = resolvePort(options);
      const isCurrent = options?.isCurrent ?? (() => true);

      try {
        await confirmSignUpTokenRaw(token, options, isCurrent);
        if (!isCurrent()) {
          return { ok: false, status: 'stale' };
        }
        resolved.trackEvent({
          name: 'email_verified',
          feature: 'auth',
        });
        return { ok: true, status: 'success' };
      } catch (error) {
        if (!isCurrent()) {
          return { ok: false, status: 'stale' };
        }
        const isLifecycle = error instanceof ConfirmSignUpLifecycleError;
        const step = isLifecycle ? error.step : 'confirm_token';
        const level = isLifecycle ? error.level : 'info';
        const rawMsg = isLifecycle
          ? error.logMessage
          : error instanceof Error
            ? error.message
            : 'Failed to confirm signup token';
        const errorCode = isLifecycle ? error.errorCode : undefined;

        const isStaticStep = isLifecycle && error.step === 'missing_token';

        resolved.trackEvent({
          name: 'auth_flow_failed',
          feature: 'auth',
          metadata: {
            flow: 'email_verify',
            error_type: step,
          },
        });
        void resolved.captureFailure({
          flow: 'email_verification',
          step,
          level,
          message: isStaticStep
            ? sanitizeAuthErrorMessage(rawMsg)
            : sanitizeAuthErrorMessage(rawMsg, [token]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: isLifecycle ? error.title : '註冊失敗',
          description:
            error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
        });
        return { ok: false, status: 'failure' };
      }
    },

    getPendingVerificationEmail(overrides) {
      const resolved = resolvePort(overrides);
      return flowStore.getVerificationEmail(resolved.storage);
    },

    async resendVerificationEmail(email, overrides) {
      const resolved = resolvePort(overrides);
      const targetEmail =
        email || flowStore.getVerificationEmail(resolved.storage);

      try {
        await resendVerificationEmailRaw(email, overrides);
        resolved.toast({
          variant: 'default',
          title: '已重新寄送',
          description: '驗證信已重新寄送！',
        });
        return { ok: true };
      } catch (err) {
        const errorCode =
          err instanceof ApiError ? String(err.status) : undefined;
        const rawMsg =
          err instanceof Error
            ? err.message
            : 'Failed to resend verification email';

        void resolved.captureFailure({
          flow: 'email_verification',
          step: 'resend',
          level: 'info',
          message: sanitizeAuthErrorMessage(rawMsg, [targetEmail, email]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: '寄送失敗',
          description:
            err instanceof Error ? err.message : '重新寄送失敗，請稍後再試。',
          duration: 5000,
        });
        return { ok: false, errorType: errorCode ?? 'resend_failed' };
      }
    },

    async requestPasswordReset(email, overrides) {
      const resolved = resolvePort(overrides);
      try {
        await requestPasswordResetRaw(email, overrides);
        return { ok: true };
      } catch (err) {
        const isLifecycle = err instanceof PasswordResetLifecycleError;
        const step = isLifecycle ? err.step : 'request_email';
        const level = isLifecycle ? err.level : 'info';
        const rawMsg = isLifecycle ? err.logMessage : getErrorMessage(err);
        const errorCode = isLifecycle ? err.errorCode : undefined;

        const isStaticStep = isLifecycle && isStaticPasswordResetStep(err.step);

        void resolved.captureFailure({
          flow: 'password_reset',
          step,
          level,
          message: isStaticStep
            ? sanitizeAuthErrorMessage(rawMsg)
            : sanitizeAuthErrorMessage(rawMsg, [email]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: isLifecycle ? err.title : '信件寄送失敗',
          description: isLifecycle ? err.message : getErrorMessage(err),
          duration: 5000,
        });
        return { ok: false, errorType: step };
      }
    },

    getPendingPasswordResetEmail(overrides) {
      const resolved = resolvePort(overrides);
      return flowStore.getPasswordResetEmail(resolved.storage);
    },

    async resendPasswordReset(email, overrides) {
      const resolved = resolvePort(overrides);
      const targetEmail =
        email || flowStore.getPasswordResetEmail(resolved.storage);

      try {
        await resendPasswordResetRaw(email, overrides);
        resolved.toast({
          title: '已成功重新發送',
          description: '請至您的電子郵箱查看。',
        });
        return { ok: true };
      } catch (err) {
        const isLifecycle = err instanceof PasswordResetLifecycleError;
        const step = isLifecycle ? err.step : 'resend_email';
        const level = isLifecycle ? err.level : 'info';
        const rawMsg = isLifecycle ? err.logMessage : getErrorMessage(err);
        const errorCode = isLifecycle ? err.errorCode : undefined;

        const isStaticStep = isLifecycle && isStaticPasswordResetStep(err.step);

        void resolved.captureFailure({
          flow: 'password_reset',
          step,
          level,
          message: isStaticStep
            ? sanitizeAuthErrorMessage(rawMsg)
            : sanitizeAuthErrorMessage(rawMsg, [targetEmail, email]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: isLifecycle ? err.title : '信件寄送失敗',
          description: isLifecycle ? err.message : getErrorMessage(err),
          duration: 5000,
        });
        return { ok: false, errorType: step };
      }
    },

    async completePasswordReset(input, overrides) {
      const resolved = resolvePort(overrides);
      try {
        await completePasswordResetRaw(input, overrides);
        return { ok: true };
      } catch (err) {
        const isLifecycle = err instanceof PasswordResetLifecycleError;
        const step = isLifecycle ? err.step : 'submit_new_password';
        const level = isLifecycle ? err.level : 'info';
        const rawMsg = isLifecycle ? err.logMessage : getErrorMessage(err);
        const errorCode = isLifecycle ? err.errorCode : undefined;

        const isStaticStep = isLifecycle && isStaticPasswordResetStep(err.step);

        void resolved.captureFailure({
          flow: 'password_reset',
          step,
          level,
          message: isStaticStep
            ? sanitizeAuthErrorMessage(rawMsg)
            : sanitizeAuthErrorMessage(rawMsg, [
                input.verifyToken,
                input.password,
                input.confirmPassword,
              ]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          title: isLifecycle ? err.title : '密碼重設失敗',
          description: isLifecycle ? err.message : getErrorMessage(err),
          duration: 5000,
        });
        return { ok: false, errorType: step };
      }
    },

    async deleteAccountXC(credentials, overrides) {
      const resolved = resolvePort(overrides);
      if (!isAccountDeletionEnabled()) {
        resolved.toast({
          variant: 'destructive',
          description: '此環境不支援帳號刪除',
          duration: 3000,
        });
        return { status: 'disabled' };
      }

      try {
        const result = await executeDeleteAccountXCRaw(credentials, overrides);
        if (
          result.status === 'success' ||
          result.status === 'blocked_reservations'
        ) {
          return result;
        }

        const message = result.message || '刪除帳號失敗，請稍後再試';
        void resolved.captureFailure({
          flow: 'delete_account',
          step: 'submit',
          level: 'info',
          message: sanitizeAuthErrorMessage(message, [
            credentials.email,
            credentials.password,
          ]),
        });
        resolved.toast({
          variant: 'destructive',
          description: message,
          duration: 3000,
        });
        return { status: 'error', message };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '刪除帳號失敗，請稍後再試';
        void resolved.captureFailure({
          flow: 'delete_account',
          step: 'submit',
          level: 'info',
          message: sanitizeAuthErrorMessage(message, [
            credentials.email,
            credentials.password,
          ]),
        });
        resolved.toast({
          variant: 'destructive',
          description: message,
          duration: 3000,
        });
        return { status: 'error', message };
      }
    },

    async startDeleteAccountGoogleReauth(email, overrides) {
      const resolved = resolvePort(overrides);
      if (!isAccountDeletionEnabled()) {
        resolved.toast({
          variant: 'destructive',
          description: '此環境不支援帳號刪除',
          duration: 3000,
        });
        return { ok: false, errorType: 'disabled' };
      }

      try {
        await initiateGoogleAuthRaw(
          { intent: 'delete_account_reauth', email },
          overrides
        );
        return { ok: true };
      } catch (err) {
        const errorCode =
          err instanceof ApiError ? String(err.status) : undefined;
        const rawMsg =
          err instanceof Error ? err.message : 'Google reauth authorize failed';

        void resolved.captureFailure({
          flow: 'delete_account',
          step: 'google_reauth_authorize',
          level: 'warning',
          message: sanitizeAuthErrorMessage(rawMsg, [email]),
          errorCode,
        });
        resolved.toast({
          variant: 'destructive',
          description: '無法取得 Google 授權連結，請稍後再試',
          duration: 3000,
        });
        return { ok: false, errorType: errorCode ?? 'authorize_failed' };
      }
    },

    getPendingDeleteAccountEmail(overrides) {
      const resolved = resolvePort(overrides);
      return flowStore.getDeleteAccountEmail(resolved.storage);
    },

    async terminateSession(reason, options) {
      return terminateSessionInternal(reason, options);
    },

    signInWithCredentialsRaw,
    signUpWithCredentialsRaw,
    initiateGoogleAuthRaw,
    confirmSignUpTokenRaw,
    resendVerificationEmailRaw,
    requestPasswordResetRaw,
    resendPasswordResetRaw,
    completePasswordResetRaw,
    executeDeleteAccountXCRaw,
    handleGoogleOAuthCallbackInternal,
    terminateSessionInternal,
  };
}

export function createAuthLifecycle(
  port: AuthLifecyclePort = {}
): AuthLifecycle {
  return createAuthLifecycleInternal(port);
}

const defaultLifecycle = createAuthLifecycleInternal();

export const authLifecycle: AuthLifecycle = defaultLifecycle;

// ─── Expand-Phase Transitional Top-Level Exports (removed in #940) ───────────

export interface TerminateClientSessionAdapters {
  signOut: ClientSignOutFn;
  callbackUrl?: string;
  storage?: SessionStorageLike | null;
  revokeBackendSession?: () => Promise<unknown>;
  revalidateAfterDelete?: () => Promise<unknown>;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

/**
 * Atomically tears down all client-side session artifacts across every sign-out
 * path (`logout`, `refresh_token_error`, `delete_account_xc`, `delete_account_google`):
 * 1. `sessionHint` cookie & DOM attributes (ADR-0001)
 * 2. GA4 / Clarity user context
 * 3. Pending auth `sessionStorage` keys (`authFlowStorage`) & pending favorite `localStorage` (`clearPendingFavoriteMentor`)
 * 4. All user-scoped in-memory read models (`notificationReadModel`, `reservationReadModel`, `scheduleReadModel`, `favoriteMentorsReadModel`, `profileReadModel`, `mentorFeedbackReadModel`)
 * 5. Reason-specific best-effort server cleanup (`postBackendLogout` or `revalidateAfterDelete`)
 * 6. NextAuth `signOut`
 */
export async function terminateClientSession(
  reason: SessionTeardownReason,
  adapters: TerminateClientSessionAdapters
): Promise<void> {
  return defaultLifecycle.terminateSessionInternal(
    reason,
    {
      signOut: adapters.signOut,
      callbackUrl: adapters.callbackUrl,
      storage: adapters.storage,
      revalidateAfterDelete: adapters.revalidateAfterDelete,
      clearAnalyticsUser: adapters.clearAnalyticsUser,
      captureFailure: adapters.captureFailure,
    },
    {
      callbackUrl: adapters.callbackUrl,
      revokeBackendSession: adapters.revokeBackendSession,
      clearSessionHint: adapters.clearSessionHint,
    }
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
  return defaultLifecycle.signInWithCredentialsRaw(values, {
    signIn: adapters.signIn,
    getSession: adapters.getSession,
    navigate: adapters.navigate,
    search: adapters.search,
    currentOrigin: adapters.currentOrigin,
    storage: adapters.storage,
    setAnalyticsUserContext: adapters.setAnalyticsUserContext,
    trackEvent: adapters.trackEvent,
  });
}

export interface SignUpWithCredentialsAdapters {
  navigate: (href: string) => void;
  signUpFn?: (input: SignUpInput) => Promise<void>;
  storage?: SessionStorageLike | null;
  trackEvent?: typeof defaultTrackEvent;
}

export async function signUpWithCredentials(
  values: SignUpInput,
  adapters: SignUpWithCredentialsAdapters
): Promise<void> {
  return defaultLifecycle.signUpWithCredentialsRaw(values, {
    navigate: adapters.navigate,
    authClient: adapters.signUpFn ? { signUp: adapters.signUpFn } : undefined,
    storage: adapters.storage,
    trackEvent: adapters.trackEvent,
  });
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
  getAuthorizeUrl?: (intent: 'login' | 'signup') => Promise<GoogleAuthorizeVO>;
}

export async function initiateGoogleAuth(
  params: InitiateGoogleAuthParams,
  adapters: InitiateGoogleAuthAdapters
): Promise<void> {
  return defaultLifecycle.initiateGoogleAuthRaw(params, {
    navigate: adapters.navigate,
    storage: adapters.storage,
    authClient: adapters.getAuthorizeUrl
      ? { getGoogleAuthorizeUrl: adapters.getAuthorizeUrl }
      : undefined,
  });
}

export interface ConfirmSignUpTokenAdapters {
  confirmSignUpFn?: (token: string) => Promise<void>;
  storage?: SessionStorageLike | null;
}

export async function confirmSignUpToken(
  token: string | null,
  adapters: ConfirmSignUpTokenAdapters = {}
): Promise<void> {
  return defaultLifecycle.confirmSignUpTokenRaw(token, {
    storage: adapters.storage,
    authClient: adapters.confirmSignUpFn
      ? { confirmSignUp: adapters.confirmSignUpFn }
      : undefined,
  });
}

export interface ResendVerificationEmailAdapters {
  email?: string | null;
  resendVerificationEmailFn?: (email: string) => Promise<void>;
  storage?: SessionStorageLike | null;
}

export async function resendVerificationEmailForPendingUser(
  adapters: ResendVerificationEmailAdapters = {}
): Promise<void> {
  return defaultLifecycle.resendVerificationEmailRaw(adapters.email, {
    storage: adapters.storage,
    authClient: adapters.resendVerificationEmailFn
      ? { resendVerificationEmail: adapters.resendVerificationEmailFn }
      : undefined,
  });
}

export interface RequestPasswordResetAdapters {
  navigate: (href: string) => void;
  requestPasswordResetEmailFn?: (email: string) => Promise<void>;
  storage?: SessionStorageLike | null;
}

export async function requestPasswordReset(
  email: string,
  adapters: RequestPasswordResetAdapters
): Promise<void> {
  return defaultLifecycle.requestPasswordResetRaw(email, {
    navigate: adapters.navigate,
    storage: adapters.storage,
    authClient: adapters.requestPasswordResetEmailFn
      ? { requestPasswordResetEmail: adapters.requestPasswordResetEmailFn }
      : undefined,
  });
}

export interface ResendPasswordResetAdapters {
  email?: string | null;
  requestPasswordResetEmailFn?: (email: string) => Promise<void>;
  storage?: SessionStorageLike | null;
}

export async function resendPasswordReset(
  adapters: ResendPasswordResetAdapters = {}
): Promise<void> {
  return defaultLifecycle.resendPasswordResetRaw(adapters.email, {
    storage: adapters.storage,
    authClient: adapters.requestPasswordResetEmailFn
      ? { requestPasswordResetEmail: adapters.requestPasswordResetEmailFn }
      : undefined,
  });
}

export interface CompletePasswordResetAdapters {
  navigate: (href: string) => void;
  resetPasswordWithTokenFn?: (
    input: ResetPasswordWithTokenInput
  ) => Promise<void>;
  storage?: SessionStorageLike | null;
}

export async function completePasswordReset(
  input: CompletePasswordResetInput,
  adapters: CompletePasswordResetAdapters
): Promise<void> {
  return defaultLifecycle.completePasswordResetRaw(input, {
    navigate: adapters.navigate,
    storage: adapters.storage,
    authClient: adapters.resetPasswordWithTokenFn
      ? { resetPasswordWithToken: adapters.resetPasswordWithTokenFn }
      : undefined,
  });
}

export interface ExecuteDeleteAccountXCAdapters {
  signOut: ClientSignOutFn;
  revalidateAfterDelete?: () => Promise<unknown>;
  deleteAccountFn?: (payload: DeleteAccountDTO) => Promise<DeleteAccountResult>;
  storage?: SessionStorageLike | null;
  trackEvent?: typeof defaultTrackEvent;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

export async function executeDeleteAccountXC(
  credentials: { email: string; password: string },
  adapters: ExecuteDeleteAccountXCAdapters
): Promise<DeleteAccountResult> {
  return defaultLifecycle.executeDeleteAccountXCRaw(credentials, {
    signOut: adapters.signOut,
    revalidateAfterDelete: adapters.revalidateAfterDelete,
    authClient: adapters.deleteAccountFn
      ? { deleteAccount: adapters.deleteAccountFn }
      : undefined,
    storage: adapters.storage,
    trackEvent: adapters.trackEvent,
    clearSessionHint: adapters.clearSessionHint,
    clearAnalyticsUser: adapters.clearAnalyticsUser,
    captureFailure: adapters.captureFailure,
  });
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
  deleteAccountFn?: (payload: DeleteAccountDTO) => Promise<DeleteAccountResult>;
  resolveOutcomeFn?: typeof resolveOAuthOutcome;
  signInWithGoogleTokenFn?: typeof signInWithGoogleToken;
  setAnalyticsUserContext?: typeof defaultSetAnalyticsUserContext;
  trackEvent?: typeof defaultTrackEvent;
  clearSessionHint?: () => void;
  clearAnalyticsUser?: () => void;
  captureFailure?: typeof defaultCaptureFlowFailure;
}

export async function executeGoogleOAuthCallback(
  params: {
    code: string | null;
    state: string | null;
    preExchanged?: OAuthCallbackResponse | null;
  },
  adapters: ExecuteGoogleOAuthCallbackAdapters
): Promise<void> {
  return defaultLifecycle.handleGoogleOAuthCallbackInternal(
    params,
    {
      exchangeGoogleCode: adapters.exchangeCode,
      signIn: adapters.signIn,
      signOut: adapters.signOut,
      getSession: adapters.getSession,
      navigate: adapters.navigate,
      toast: adapters.onToast,
      revalidateAfterDelete: adapters.revalidateAfterDelete,
      storage: adapters.storage,
      authClient: adapters.deleteAccountFn
        ? { deleteAccount: adapters.deleteAccountFn }
        : undefined,
      setAnalyticsUserContext: adapters.setAnalyticsUserContext,
      trackEvent: adapters.trackEvent,
      clearAnalyticsUser: adapters.clearAnalyticsUser,
      captureFailure: adapters.captureFailure,
    },
    {
      resolveOutcomeFn: adapters.resolveOutcomeFn,
      signInWithGoogleTokenFn: adapters.signInWithGoogleTokenFn,
      clearSessionHint: adapters.clearSessionHint,
      currentOrigin: adapters.currentOrigin,
    }
  );
}

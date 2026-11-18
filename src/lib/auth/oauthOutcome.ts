import type { components } from '@/types/api';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

export type OAuthInvalidErrorType =
  'MISSING_PARAMS' | 'CALLBACK_FAILED' | 'DELETE_FLOW_INVALID';

export type OAuthOutcome =
  | { type: 'LOGIN'; data: GoogleCallbackVO }
  | { type: 'SIGNUP'; data: GoogleCallbackVO }
  | { type: 'RESUME_DELETE_ACCOUNT'; data: GoogleCallbackVO; email: string }
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

export interface GoogleProfileFallback {
  name?: string;
  avatar?: string;
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
 * Handles standard (`=s96-c`), extended FIFE (`=s96-c-mo`), and unsuffixed paths,
 * while rejecting custom ports, embedded credentials, bare root paths, and other hosts.
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
 * configured S3 `images.remotePatterns` allowlist over default-port HTTPS with a
 * non-root object path.
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
 * (`user.onboarding === false`), bridging the async Auth outbox -> SQS -> User
 * projection window without overwriting saved profile fields.
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
 * Helper to sign in with NextAuth custom-google-token provider via injected
 * client signIn adapter (keeps src/lib/auth free of next-auth/react imports).
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
 * Resolves the state machine outcome of a Google OAuth callback via an
 * injected code-exchange adapter.
 */
export async function resolveOAuthOutcome(
  code: string | null,
  state: string | null,
  options: ResolveOAuthOutcomeOptions
): Promise<OAuthOutcome> {
  if (!code || !state) {
    return { type: 'INVALID', errorType: 'MISSING_PARAMS' };
  }

  try {
    const res = await options.exchangeCode(code, state);
    const callbackData = res?.data;

    if (!callbackData) {
      return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
    }

    if (options.pendingDeleteAccountEmail) {
      if (callbackData.auth_type === 'LOGIN') {
        return {
          type: 'RESUME_DELETE_ACCOUNT',
          data: callbackData,
          email: options.pendingDeleteAccountEmail,
        };
      }
      return { type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' };
    }

    if (callbackData.auth_type === 'SIGNUP') {
      return { type: 'SIGNUP', data: callbackData };
    }

    return { type: 'LOGIN', data: callbackData };
  } catch {
    return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
  }
}

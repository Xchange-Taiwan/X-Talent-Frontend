/**
 * Frontend Behavior Analytics
 *
 * Unified analytics layer that dispatches to both:
 *   - Google Analytics 4 (page_view, scroll_depth, button_click, funnel events via gtag / dataLayer)
 *   - Microsoft Clarity  (session replay, heatmaps, custom events, session tags)
 *
 * Strictly enforces zero-PII guardrails: Email, real names, passwords, OAuth codes,
 * phone/mailto URIs, free-text search queries, and authentication tokens are stripped
 * from URLs, page titles, and event metadata before leaving the application layer.
 */

export const ANALYTICS_FEATURES = [
  'auth',
  'onboarding',
  'mentor_pool',
  'profile',
  'reservation',
  'feedback',
  'performance',
  'navigation',
  'engagement',
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export const ANALYTICS_USER_ROLES = ['mentee', 'mentor', 'guest'] as const;
export type AnalyticsUserRole = (typeof ANALYTICS_USER_ROLES)[number];

export const ANALYTICS_AUTH_METHODS = ['Google', 'Email'] as const;
export type AnalyticsAuthMethod = (typeof ANALYTICS_AUTH_METHODS)[number];

export interface AnalyticsUserContext {
  /** Internal opaque User ID from NextAuth session.user.id (NEVER email, name, or token); null clears GA4 user_id */
  userId: string | number | null | undefined;
  /** Resolved platform role attached to GA4 config & events */
  userRole?: AnalyticsUserRole | null;
}

export interface SetAnalyticsUserContextOptions {
  /** Explicit GA4 Measurement ID override (defaults to active Ga4Bootstrap ID or NEXT_PUBLIC_GA_ID) */
  gaId?: string;
}

export const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 100] as const;
export type ScrollDepthThreshold = (typeof SCROLL_DEPTH_THRESHOLDS)[number];

export interface AnalyticsEvent {
  /** Snake_case event name, e.g. 'login', 'sign_up', 'reservation_booking_confirmed' */
  name: string;
  /** Feature domain for grouping */
  feature?: AnalyticsFeature;
  /** Non-PII metadata (counts, status strings, step numbers — NEVER user content) */
  metadata?: Record<string, string | number | boolean>;
}

export interface TrackEventOptions {
  /** Skip sending to Microsoft Clarity (useful for high-frequency performance or scroll metrics) */
  skipClarity?: boolean;
}

export interface TrackPageViewOptions {
  /** Explicit page title override (still subject to PII/route sanitization) */
  title?: string;
  /** Explicit origin override (defaults to window.location.origin on client) */
  origin?: string;
}

export interface ButtonClickParams {
  /** Stable snake_case identifier for the clicked button/link, e.g. 'header_signin' */
  buttonId: string;
  /** Optional custom snake_case GA4 event name (defaults to 'button_click') */
  eventName?: string;
  /** UI placement/section where the button lives, e.g. 'header', 'hero', 'footer' */
  location?: string;
  /** Optional target URL or pathname for navigation buttons/links */
  destination?: string;
  /** Optional feature domain */
  feature?: AnalyticsFeature;
  /** Additional non-PII scalar attributes */
  metadata?: Record<string, string | number | boolean>;
}

type ClarityFn = (...args: unknown[]) => void;

const VALID_ANALYTICS_FEATURES: ReadonlySet<string> = new Set<string>(
  ANALYTICS_FEATURES
);
const VALID_ANALYTICS_USER_ROLES: ReadonlySet<string> = new Set<string>(
  ANALYTICS_USER_ROLES
);

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const VALID_EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,48}$/;
const VALID_PARAM_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const SAFE_INTERNAL_USER_ID_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9_-]{1,64}$/;
const FORBIDDEN_USER_ID_VALUE_PATTERN =
  /^(?:0+|null|undefined|nan|true|false|none|guest|anonymous|eyJ[A-Za-z0-9_-]{8,}|.*(?:access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|csrf[_-]?token|bearer|secret|password).*)$/i;

const PII_KEY_PATTERN =
  /^(?:e[-_]?mail|user[-_]?email|password|passwd|pwd|.*token.*|secret|authorization|auth[-_]?code|code|state|cookie|phone|mobile|tel|name|user[-_]?name|full[-_]?name|first[-_]?name|last[-_]?name|real[-_]?name|display[-_]?name|q|query|search|search[-_]?pattern|keyword)$/i;

const SENSITIVE_QUERY_PARAM_PATTERN =
  /^(?:e[-_]?mail|password|passwd|pwd|.*token.*|secret|code|state|session|auth|phone|mobile|tel|name|user[-_]?name|full[-_]?name|first[-_]?name|last[-_]?name|real[-_]?name|display[-_]?name|q|query|search|search[-_]?pattern|keyword)$/i;

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const JWT_VALUE_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i;
const DISALLOWED_VALUE_SCHEME_PATTERN =
  /^(?:javascript|data|vbscript|mailto|tel|sms):/i;
const URI_SCHEME_PREFIX_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

const PROFILE_EDIT_PATH_PATTERN =
  /^\/profile\/(?!card(?:\/|$))[^/]+\/edit(?:\/|$)/;
const PROFILE_DETAIL_PATH_PATTERN = /^\/profile\/(?!card(?:\/|$))[^/]+(?:\/|$)/;
const MENTOR_PROFILE_TITLE_PATTERN = /-\s*導師專業背景(?:\s*\|\s*.*)?$/;

const INTERNAL_RELATIVE_PATH_ORIGIN = 'https://xtalent.local';
const BACKSLASH_CHAR = String.fromCharCode(92);
const MAX_NESTED_URL_SANITIZE_DEPTH = 3;
const MAX_URI_DECODE_PASSES = 3;

let configuredGaTargetsByFn = new WeakMap<object, Set<string>>();
let lastSyncedUserKeyByTarget = new WeakMap<object, Map<string, string>>();

let activeGaMeasurementId: string | null = null;
let currentAnalyticsUserId: string | null = null;
let currentAnalyticsUserRole: AnalyticsUserRole | null = null;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unwrapPercentEncoding(
  value: string,
  maxPasses = MAX_URI_DECODE_PASSES
): string {
  let current = value;
  for (let i = 0; i < maxPasses; i++) {
    const next = safeDecodeURIComponent(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function isRootRelativeInternalPath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes(BACKSLASH_CHAR)
  );
}

function parseAllowlistedAnalyticsUrl(
  rawUrlOrPath: string
): { parsed: URL; isAbsolute: boolean } | null {
  const trimmed = rawUrlOrPath.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return null;
  }

  if (isRootRelativeInternalPath(trimmed)) {
    try {
      const parsed = new URL(trimmed, INTERNAL_RELATIVE_PATH_ORIGIN);
      if (
        parsed.origin !== INTERNAL_RELATIVE_PATH_ORIGIN ||
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      ) {
        return null;
      }
      return { parsed, isAbsolute: false };
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return { parsed, isAbsolute: true };
  } catch {
    return null;
  }
}

export function isValidGaMeasurementId(
  rawGaId: string | null | undefined
): rawGaId is string {
  if (typeof rawGaId !== 'string') return false;
  return GA_MEASUREMENT_ID_PATTERN.test(rawGaId.trim());
}

/**
 * Allowlist validation for analytics URLs: accepts only internal root-relative paths
 * (`/foo`, never protocol-relative `//` or `/`) or explicit `http:` / `https:` URLs.
 * Rejects `javascript:`, `data:`, `vbscript:`, `mailto:`, `tel:`, `#`, and malformed URIs.
 */
export function isAllowedAnalyticsUrl(rawUrlOrPath: string): boolean {
  return parseAllowlistedAnalyticsUrl(rawUrlOrPath) !== null;
}

export function isUserProfilePath(pathOrUrl: string): boolean {
  const pathnameOnly = (pathOrUrl.split('?')[0] ?? '/').split('#')[0] ?? '/';
  return (
    PROFILE_EDIT_PATH_PATTERN.test(pathnameOnly) ||
    PROFILE_DETAIL_PATH_PATTERN.test(pathnameOnly)
  );
}

export function containsSensitiveValue(value: string): boolean {
  const trimmed = value.trim();
  return (
    EMAIL_VALUE_PATTERN.test(trimmed) ||
    JWT_VALUE_PATTERN.test(trimmed) ||
    BEARER_VALUE_PATTERN.test(trimmed) ||
    DISALLOWED_VALUE_SCHEME_PATTERN.test(trimmed)
  );
}

export function isAnalyticsUserRole(
  value: unknown
): value is AnalyticsUserRole {
  return typeof value === 'string' && VALID_ANALYTICS_USER_ROLES.has(value);
}

/**
 * Validates and normalizes an internal opaque User ID for GA4 `user_id`.
 * Rejects emails, real names (spaces / non-ASCII), JWTs, tokens, URI schemes, or empty values.
 */
export function sanitizeAnalyticsUserId(
  rawUserId: string | number | null | undefined
): string | null {
  if (typeof rawUserId === 'number') {
    if (!Number.isSafeInteger(rawUserId) || rawUserId <= 0) return null;
    return String(rawUserId);
  }
  if (typeof rawUserId !== 'string') return null;

  const trimmed = rawUserId.trim();
  if (!trimmed) return null;

  const fullyDecoded = unwrapPercentEncoding(trimmed);
  if (
    !SAFE_INTERNAL_USER_ID_PATTERN.test(trimmed) ||
    FORBIDDEN_USER_ID_VALUE_PATTERN.test(trimmed) ||
    FORBIDDEN_USER_ID_VALUE_PATTERN.test(fullyDecoded) ||
    containsSensitiveValue(trimmed) ||
    containsSensitiveValue(fullyDecoded)
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Resolves the canonical `AnalyticsUserRole` (`'mentor' | 'mentee' | 'guest'`)
 * from a NextAuth session user or backend profile summary.
 */
export function resolveAnalyticsUserRole(
  user?: {
    id?: string | number | null;
    user_id?: string | number | null;
    isMentor?: boolean | null;
    is_mentor?: boolean | null;
  } | null
): AnalyticsUserRole {
  if (!user) return 'guest';
  const safeId =
    sanitizeAnalyticsUserId(user.id) ?? sanitizeAnalyticsUserId(user.user_id);
  if (!safeId) return 'guest';
  return (user.isMentor ?? user.is_mentor) ? 'mentor' : 'mentee';
}

/**
 * Strips any PII keys (email, name, token, password, phone, free-text query, OAuth code/state)
 * and drops string values that match email, JWT, Bearer token, or disallowed URI scheme patterns.
 */
export function sanitizeAnalyticsMetadata(
  metadata?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  if (!metadata) return {};

  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const trimmedKey = key.trim();
    if (!trimmedKey || PII_KEY_PATTERN.test(trimmedKey)) {
      continue;
    }
    const lowerKey = trimmedKey.toLowerCase();
    if (lowerKey === 'user_id') {
      const safeUid =
        typeof value === 'string' || typeof value === 'number'
          ? sanitizeAnalyticsUserId(value)
          : null;
      if (safeUid) {
        clean[trimmedKey] = safeUid;
      }
      continue;
    }
    if (lowerKey === 'user_role') {
      if (isAnalyticsUserRole(value)) {
        clean[trimmedKey] = value;
      }
      continue;
    }
    if (typeof value === 'string') {
      const fullyDecoded = unwrapPercentEncoding(value);
      if (
        containsSensitiveValue(value) ||
        containsSensitiveValue(fullyDecoded)
      ) {
        continue;
      }
      clean[trimmedKey] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      clean[trimmedKey] = value;
    } else if (typeof value === 'boolean') {
      clean[trimmedKey] = value;
    }
  }
  return clean;
}

function sanitizeUrlInternal(rawUrlOrPath: string, depth: number): string {
  const allowlisted = parseAllowlistedAnalyticsUrl(rawUrlOrPath);
  if (!allowlisted) return '/';

  const { parsed, isAbsolute } = allowlisted;
  const decodedPathname = unwrapPercentEncoding(parsed.pathname || '/');
  if (
    containsSensitiveValue(parsed.pathname) ||
    containsSensitiveValue(decodedPathname)
  ) {
    return isAbsolute ? `${parsed.origin}/` : '/';
  }

  const safeParams = new URLSearchParams();
  parsed.searchParams.forEach((val, key) => {
    if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) return;

    const trimmedVal = val.trim();
    const fullyDecoded = unwrapPercentEncoding(trimmedVal).trim();
    const slashBackslashPrefix = `/${BACKSLASH_CHAR}`;

    if (
      trimmedVal.startsWith('//') ||
      fullyDecoded.startsWith('//') ||
      trimmedVal.startsWith(slashBackslashPrefix) ||
      fullyDecoded.startsWith(slashBackslashPrefix)
    ) {
      return;
    }

    const nestedCandidate = isRootRelativeInternalPath(trimmedVal)
      ? trimmedVal
      : isRootRelativeInternalPath(fullyDecoded)
        ? fullyDecoded
        : null;

    if (nestedCandidate !== null) {
      if (depth >= MAX_NESTED_URL_SANITIZE_DEPTH) {
        // Fail-closed when nested callback URL exceeds max recursion depth
        return;
      }
      safeParams.append(key, sanitizeUrlInternal(nestedCandidate, depth + 1));
      return;
    }

    const schemeCandidate = URI_SCHEME_PREFIX_PATTERN.test(trimmedVal)
      ? trimmedVal
      : URI_SCHEME_PREFIX_PATTERN.test(fullyDecoded)
        ? fullyDecoded
        : null;

    if (schemeCandidate !== null) {
      if (!isAllowedAnalyticsUrl(schemeCandidate)) {
        // Reject javascript:, data:, vbscript:, mailto:, tel:, sms:, etc.
        return;
      }
      if (depth >= MAX_NESTED_URL_SANITIZE_DEPTH) {
        return;
      }
      safeParams.append(key, sanitizeUrlInternal(schemeCandidate, depth + 1));
      return;
    }

    if (
      containsSensitiveValue(trimmedVal) ||
      containsSensitiveValue(fullyDecoded)
    ) {
      return;
    }

    safeParams.append(key, val);
  });

  const query = safeParams.toString();
  const pathWithQuery = `${parsed.pathname || '/'}${query ? `?${query}` : ''}`;
  return isAbsolute ? `${parsed.origin}${pathWithQuery}` : pathWithQuery;
}

/**
 * Sanitizes a URL or path for GA4 reporting by enforcing an explicit `http:` / `https:`
 * and single-leading-`/` allowlist, stripping hash fragments, redacting sensitive path
 * segments, and recursively scrubbing nested `callbackUrl` query parameters.
 */
export function sanitizeUrlForAnalytics(rawUrlOrPath: string): string {
  return sanitizeUrlInternal(rawUrlOrPath, 0);
}

/**
 * Ensures dynamic user/mentor profile titles (e.g. "<Name> - 導師專業背景" or "<Name>")
 * never leak real user names to GA4 `page_title`.
 */
export function resolveSafePageTitle(
  cleanPath: string,
  rawTitle?: string
): string {
  const pathnameOnly = cleanPath.split('?')[0] ?? '/';
  if (PROFILE_EDIT_PATH_PATTERN.test(pathnameOnly)) {
    return 'Profile Edit';
  }
  if (PROFILE_DETAIL_PATH_PATTERN.test(pathnameOnly)) {
    return 'User Profile';
  }

  const candidate = (rawTitle ?? '').trim();
  if (MENTOR_PROFILE_TITLE_PATTERN.test(candidate)) {
    return 'User Profile';
  }
  if (!candidate || containsSensitiveValue(candidate)) {
    return 'X-Talent';
  }
  return candidate;
}

function resolveDefaultGaPageContext(): {
  page_location?: string;
  page_title?: string;
} {
  if (typeof window === 'undefined') return {};

  const rawPathname = window.location?.pathname || '/';
  const cleanPath = sanitizeUrlForAnalytics(rawPathname);
  const rawHref = window.location?.href ?? '';
  const safeLocation =
    rawHref && isAllowedAnalyticsUrl(rawHref)
      ? sanitizeUrlForAnalytics(rawHref)
      : cleanPath;
  const rawTitle = typeof document !== 'undefined' ? document.title : undefined;
  const safeTitle = resolveSafePageTitle(cleanPath, rawTitle);

  return {
    page_location: safeLocation,
    page_title: safeTitle,
  };
}

function resolveConfiguredGaId(explicitGaId?: string): string | null {
  if (isValidGaMeasurementId(explicitGaId)) {
    return explicitGaId.trim();
  }
  if (activeGaMeasurementId && isValidGaMeasurementId(activeGaMeasurementId)) {
    return activeGaMeasurementId;
  }
  const envGaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (isValidGaMeasurementId(envGaId)) {
    return envGaId;
  }
  return null;
}

/**
 * Initializes the client-side `window.dataLayer` and `window.gtag` command queue
 * without inline `<script>` string concatenation, disabling automatic `page_view`
 * so `PageViewTracker` remains the single source of truth for initial and SPA views.
 */
export function initGa4(gaId: string): boolean {
  if (typeof window === 'undefined') return false;
  const trimmedId = gaId.trim();
  if (!isValidGaMeasurementId(trimmedId)) return false;

  activeGaMeasurementId = trimmedId;

  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }

  let configuredTargets = configuredGaTargetsByFn.get(window.gtag);
  if (!configuredTargets) {
    configuredTargets = new Set<string>();
    configuredGaTargetsByFn.set(window.gtag, configuredTargets);
  }

  if (!configuredTargets.has(trimmedId)) {
    configuredTargets.add(trimmedId);
    const defaultContext = resolveDefaultGaPageContext();
    window.gtag('js', new Date());
    window.gtag('config', trimmedId, {
      send_page_view: false,
      ...defaultContext,
      ...(currentAnalyticsUserId ? { user_id: currentAnalyticsUserId } : {}),
      ...(currentAnalyticsUserRole
        ? { user_role: currentAnalyticsUserRole }
        : {}),
    });
  }

  return true;
}

function getClarity(): ClarityFn | undefined {
  if (typeof window === 'undefined') return undefined;
  const fn = window.clarity;
  return typeof fn === 'function' ? fn : undefined;
}

function pushGtagArguments(
  command: 'config',
  targetId: string,
  configParams: Record<string, unknown>
): void;
function pushGtagArguments(
  command: 'set',
  setParams: Record<string, unknown>
): void;
function pushGtagArguments(): void {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  // gtag.js processes command tuples queued in `window.dataLayer` only when pushed
  // as `IArguments` (`arguments`), ignoring plain Array literals.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function hasAlreadySyncedTarget(
  target: object,
  gaTargetKey: string,
  syncValue: string
): boolean {
  let perGaMap = lastSyncedUserKeyByTarget.get(target);
  if (!perGaMap) {
    perGaMap = new Map<string, string>();
    lastSyncedUserKeyByTarget.set(target, perGaMap);
  }
  if (perGaMap.get(gaTargetKey) === syncValue) {
    return true;
  }
  perGaMap.set(gaTargetKey, syncValue);
  return false;
}

/**
 * Synchronizes the authenticated (or guest/logged-out) user identity and role with GA4:
 * - On login: sets `gtag('config', gaId, { send_page_view: false, user_id, user_role })`
 *   and attaches `user_id` + `user_role` to all subsequent events.
 * - On logout (`userId: null`): dispatches `user_id: null` and `user_role: 'guest'`
 *   to clear GA4's active User-ID and prevents stale `user_id` from attaching to events.
 */
export function setAnalyticsUserContext(
  context: AnalyticsUserContext,
  options?: SetAnalyticsUserContextOptions
): void {
  const safeUserId = sanitizeAnalyticsUserId(context.userId);
  const resolvedRole: AnalyticsUserRole | null = safeUserId
    ? isAnalyticsUserRole(context.userRole) && context.userRole !== 'guest'
      ? context.userRole
      : 'mentee'
    : context.userRole === null
      ? null
      : 'guest';

  currentAnalyticsUserId = safeUserId;
  currentAnalyticsUserRole = resolvedRole;

  if (typeof window === 'undefined') return;

  const gaId = resolveConfiguredGaId(options?.gaId);
  const gaTargetKey = gaId ?? 'default';
  const syncValue = `${safeUserId ?? 'null'}|${resolvedRole ?? 'null'}`;

  if (typeof window.gtag === 'function') {
    if (!hasAlreadySyncedTarget(window.gtag, gaTargetKey, syncValue)) {
      if (gaId) {
        window.gtag('config', gaId, {
          send_page_view: false,
          user_id: safeUserId,
          ...(resolvedRole ? { user_role: resolvedRole } : {}),
        });
      } else {
        window.gtag('set', {
          user_id: safeUserId,
          ...(resolvedRole ? { user_role: resolvedRole } : {}),
        });
      }
    }
  } else {
    if (!Array.isArray(window.dataLayer)) {
      window.dataLayer = [];
    }
    if (!hasAlreadySyncedTarget(window.dataLayer, gaTargetKey, syncValue)) {
      if (gaId) {
        pushGtagArguments('config', gaId, {
          send_page_view: false,
          user_id: safeUserId,
          ...(resolvedRole ? { user_role: resolvedRole } : {}),
        });
      } else {
        pushGtagArguments('set', {
          user_id: safeUserId,
          ...(resolvedRole ? { user_role: resolvedRole } : {}),
        });
      }
    }
  }

  if (resolvedRole) {
    setAnalyticsTag('user_role', resolvedRole);
  }
}

/**
 * Explicitly clears GA4 `user_id` (`null`) and resets `user_role` to `'guest'`.
 * Call right before `signOut()` so GA4 receives the null clearance before navigation.
 */
export function clearAnalyticsUser(
  options?: SetAnalyticsUserContextOptions
): void {
  setAnalyticsUserContext({ userId: null, userRole: 'guest' }, options);
}

/**
 * Returns a snapshot of the currently active analytics user context.
 */
export function getAnalyticsUserContext(): {
  userId: string | null;
  userRole: AnalyticsUserRole | null;
} {
  return {
    userId: currentAnalyticsUserId,
    userRole: currentAnalyticsUserRole,
  };
}

/**
 * Resets internal module state (intended for test suite isolation).
 */
export function resetAnalyticsUserState(): void {
  activeGaMeasurementId = null;
  currentAnalyticsUserId = null;
  currentAnalyticsUserRole = null;
  configuredGaTargetsByFn = new WeakMap<object, Set<string>>();
  lastSyncedUserKeyByTarget = new WeakMap<object, Map<string, string>>();
}

function dispatchGa4Event(
  eventName: string,
  params: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return;

  const payload: Record<string, string | number | boolean> = {
    ...resolveDefaultGaPageContext(),
    ...(currentAnalyticsUserId ? { user_id: currentAnalyticsUserId } : {}),
    ...(currentAnalyticsUserRole
      ? { user_role: currentAnalyticsUserRole }
      : {}),
    ...params,
  };

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload);
    return;
  }

  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push({
    event: eventName,
    ...payload,
  });
}

function resolveCurrentPagePath(): string | undefined {
  if (typeof window === 'undefined' || !window.location?.pathname) {
    return undefined;
  }
  return sanitizeUrlForAnalytics(window.location.pathname);
}

/**
 * Tag the current Clarity session with a custom key-value pair.
 * Strictly drops PII keys or sensitive values.
 */
export function setAnalyticsTag(key: string, value: string): void {
  const trimmedKey = key.trim();
  if (
    !trimmedKey ||
    PII_KEY_PATTERN.test(trimmedKey) ||
    containsSensitiveValue(value) ||
    containsSensitiveValue(unwrapPercentEncoding(value))
  ) {
    return;
  }
  const clarity = getClarity();
  if (!clarity) return;
  clarity('set', trimmedKey, value);
}

/**
 * Fire a custom analytics event to both GA4 (`gtag` / `window.dataLayer`) and Clarity.
 *
 * Safe to call anywhere — SSR-safe and automatically scrubs PII metadata.
 */
export function trackEvent(
  event: AnalyticsEvent,
  options?: TrackEventOptions
): void {
  const safeMetadata = sanitizeAnalyticsMetadata(event.metadata);
  const gaParams: Record<string, string | number | boolean> = {
    ...(event.feature ? { feature: event.feature } : {}),
    ...safeMetadata,
  };

  dispatchGa4Event(event.name, gaParams);

  // Microsoft Clarity — custom event + scrubbed session tags for session replay filtering
  if (!options?.skipClarity) {
    const clarity = getClarity();
    if (clarity) {
      clarity('event', event.name);
      if (event.feature) {
        setAnalyticsTag('feature', event.feature);
      }
      for (const [key, value] of Object.entries(safeMetadata)) {
        if (key.toLowerCase() === 'user_id') continue;
        setAnalyticsTag(key, String(value));
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] trackEvent', event.name, gaParams, options);
  }
}

/**
 * Track initial page load and SPA route changes in GA4 via explicit `page_view` events.
 * Works in tandem with `{ send_page_view: false }` initialized by `Ga4Bootstrap`.
 */
export function trackPageView(
  path: string,
  options?: TrackPageViewOptions
): void {
  if (typeof window === 'undefined') return;

  const cleanPath = sanitizeUrlForAnalytics(path || window.location.pathname);
  const origin = options?.origin ?? window.location?.origin ?? '';
  const pageLocation = origin
    ? sanitizeUrlForAnalytics(`${origin}${cleanPath}`)
    : cleanPath;
  const rawTitle =
    options?.title !== undefined
      ? options.title
      : typeof document !== 'undefined'
        ? document.title
        : undefined;
  const pageTitle = resolveSafePageTitle(cleanPath, rawTitle);

  const payload: Record<string, string | number | boolean> = {
    page_path: cleanPath,
    page_location: pageLocation,
    page_title: pageTitle,
  };

  dispatchGa4Event('page_view', payload);

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] trackPageView', payload);
  }
}

/**
 * Track vertical scroll milestones using a single unified `scroll_depth` GA4 event
 * with the numeric `percent_scrolled` parameter (25 / 50 / 75 / 100).
 */
export function trackScrollDepth(
  percentScrolled: number,
  pagePath?: string
): void {
  if (
    !Number.isFinite(percentScrolled) ||
    percentScrolled <= 0 ||
    percentScrolled > 100
  ) {
    return;
  }

  const resolvedPath = sanitizeUrlForAnalytics(
    pagePath ?? resolveCurrentPagePath() ?? '/'
  );

  trackEvent(
    {
      name: 'scroll_depth',
      feature: 'engagement',
      metadata: {
        percent_scrolled: Math.round(percentScrolled),
        page_path: resolvedPath,
      },
    },
    { skipClarity: true }
  );
}

/**
 * Concise, low-intrusiveness helper for button/CTA click tracking.
 * Emits `button_click` (or a validated custom `eventName`) without leaking user PII.
 */
export function trackButtonClick({
  buttonId,
  eventName,
  location,
  destination,
  feature = 'navigation',
  metadata,
}: ButtonClickParams): void {
  const cleanButtonId = buttonId.trim();
  if (!cleanButtonId || containsSensitiveValue(cleanButtonId)) return;

  const resolvedEventName =
    eventName && VALID_EVENT_NAME_PATTERN.test(eventName.trim())
      ? eventName.trim()
      : 'button_click';

  const currentPath = resolveCurrentPagePath();
  const safeExtra = sanitizeAnalyticsMetadata(metadata);
  const trimmedDest = destination?.trim() ?? '';
  const safeLinkUrl =
    trimmedDest && isAllowedAnalyticsUrl(trimmedDest)
      ? sanitizeUrlForAnalytics(trimmedDest)
      : undefined;

  const mergedMetadata: Record<string, string | number | boolean> = {
    ...safeExtra,
    button_id: cleanButtonId,
    ...(location?.trim() ? { button_location: location.trim() } : {}),
    ...(safeLinkUrl ? { link_url: safeLinkUrl } : {}),
    ...(currentPath ? { page_path: currentPath } : {}),
  };

  trackEvent({
    name: resolvedEventName,
    feature,
    metadata: mergedMetadata,
  });
}

function isAnalyticsFeature(value: string): value is AnalyticsFeature {
  return VALID_ANALYTICS_FEATURES.has(value);
}

function extractDeclarativeParams(
  element: Element
): Record<string, string | number | boolean> {
  const rawParams: Record<string, string | number | boolean> = {};
  const prefix = 'data-analytics-param-';

  for (const attr of Array.from(element.attributes)) {
    if (!attr.name.startsWith(prefix)) continue;
    const rawKey = attr.name
      .slice(prefix.length)
      .replace(/-/g, '_')
      .toLowerCase();
    const val = attr.value.trim();
    if (!val || !VALID_PARAM_KEY_PATTERN.test(rawKey)) continue;
    rawParams[rawKey] = val;
  }

  return sanitizeAnalyticsMetadata(rawParams);
}

/**
 * Extracts declarative `ButtonClickParams` from a DOM click target annotated with
 * `data-analytics-click="<button_id>"` (plus optional `data-analytics-event`,
 * `data-analytics-location`, `data-analytics-feature`, `data-analytics-omit-destination`,
 * and `data-analytics-param-*` business attributes).
 * Returns `null` if no active annotated ancestor exists or if the target/ancestor is disabled.
 */
export function getAnalyticsClickPayloadFromElement(
  target: EventTarget | null
): ButtonClickParams | null {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return null;
  }

  const annotated = target.closest('[data-analytics-click]');
  if (!annotated) return null;

  if (target.closest('[disabled],[aria-disabled="true"]')) {
    return null;
  }

  const buttonId = annotated.getAttribute('data-analytics-click')?.trim() ?? '';
  if (!buttonId || containsSensitiveValue(buttonId)) return null;

  const rawEventName =
    annotated.getAttribute('data-analytics-event')?.trim() ?? '';
  const eventName = VALID_EVENT_NAME_PATTERN.test(rawEventName)
    ? rawEventName
    : undefined;

  const location =
    annotated.getAttribute('data-analytics-location')?.trim() || undefined;
  const rawFeature =
    annotated.getAttribute('data-analytics-feature')?.trim() || '';
  const feature = isAnalyticsFeature(rawFeature) ? rawFeature : undefined;

  const omitDestination =
    annotated.getAttribute('data-analytics-omit-destination') === 'true';
  const anchor =
    annotated instanceof HTMLAnchorElement ? annotated : annotated.closest('a');
  const rawHref = anchor?.getAttribute('href')?.trim() ?? '';
  const destination =
    !omitDestination && isAllowedAnalyticsUrl(rawHref)
      ? sanitizeUrlForAnalytics(rawHref)
      : undefined;

  const metadata = extractDeclarativeParams(annotated);
  const hasMetadata = Object.keys(metadata).length > 0;

  return {
    buttonId,
    ...(eventName ? { eventName } : {}),
    ...(location ? { location } : {}),
    ...(destination ? { destination } : {}),
    ...(feature ? { feature } : {}),
    ...(hasMetadata ? { metadata } : {}),
  };
}

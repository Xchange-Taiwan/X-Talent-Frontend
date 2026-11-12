/**
 * Frontend Behavior Analytics
 *
 * Unified analytics layer that dispatches to both:
 *   - Google Analytics 4 (page_view, scroll_depth, button_click, funnel events via gtag / dataLayer)
 *   - Microsoft Clarity  (session replay, heatmaps, custom events)
 *
 * Strictly enforces zero-PII guardrails: Email, real names, passwords, OAuth codes,
 * and authentication tokens are stripped from URLs, page titles, and event metadata
 * before leaving the application layer.
 */

export type AnalyticsFeature =
  | 'auth'
  | 'onboarding'
  | 'mentor_pool'
  | 'profile'
  | 'reservation'
  | 'feedback'
  | 'performance'
  | 'navigation'
  | 'engagement';

export const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 90] as const;
export type ScrollDepthThreshold = (typeof SCROLL_DEPTH_THRESHOLDS)[number];

export interface AnalyticsEvent {
  /** Snake_case event name, e.g. 'sign_up_succeeded', 'reservation_booking_confirmed' */
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

const PII_KEY_PATTERN =
  /^(?:e[-_]?mail|user[-_]?email|password|passwd|pwd|.*token.*|secret|authorization|auth[-_]?code|code|state|cookie|phone|mobile|tel|name|user[-_]?name|full[-_]?name|first[-_]?name|last[-_]?name|real[-_]?name|display[-_]?name)$/i;

const SENSITIVE_QUERY_PARAM_PATTERN =
  /^(?:e[-_]?mail|password|passwd|pwd|.*token.*|secret|code|state|session|auth|phone|mobile|name|user[-_]?name|full[-_]?name)$/i;

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const JWT_VALUE_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i;

const PROFILE_EDIT_PATH_PATTERN =
  /^\/profile\/(?!card(?:\/|$))[^/]+\/edit(?:\/|$)/;
const PROFILE_DETAIL_PATH_PATTERN = /^\/profile\/(?!card(?:\/|$))[^/]+(?:\/|$)/;

export function containsSensitiveValue(value: string): boolean {
  return (
    EMAIL_VALUE_PATTERN.test(value) ||
    JWT_VALUE_PATTERN.test(value) ||
    BEARER_VALUE_PATTERN.test(value)
  );
}

/**
 * Strips any PII keys (email, name, token, password, phone, OAuth code/state)
 * and drops string values that match email, JWT, or Bearer token patterns.
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
    if (typeof value === 'string') {
      if (containsSensitiveValue(value)) {
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

/**
 * Sanitizes a URL or path for GA4 reporting by stripping hash fragments and
 * removing query parameters that could contain tokens, OAuth codes, emails, or names.
 */
export function sanitizeUrlForAnalytics(rawUrlOrPath: string): string {
  const trimmed = rawUrlOrPath.trim();
  if (!trimmed) return '/';

  const isAbsolute = /^https?:\/\//i.test(trimmed);
  try {
    const parsed = new URL(trimmed, 'https://xtalent.local');
    const safeParams = new URLSearchParams();

    parsed.searchParams.forEach((val, key) => {
      if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) return;
      if (containsSensitiveValue(val)) return;
      safeParams.append(key, val);
    });

    const query = safeParams.toString();
    const pathWithQuery = `${parsed.pathname || '/'}${query ? `?${query}` : ''}`;
    return isAbsolute ? `${parsed.origin}${pathWithQuery}` : pathWithQuery;
  } catch {
    const withoutHash = trimmed.split('#')[0] ?? '/';
    const withoutQuery = withoutHash.split('?')[0] ?? '/';
    return withoutQuery.startsWith('/') ? withoutQuery : '/';
  }
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
  if (!candidate || containsSensitiveValue(candidate)) {
    return 'X-Talent';
  }
  return candidate;
}

function getClarity(): ClarityFn | undefined {
  if (typeof window === 'undefined') return undefined;
  const fn = window.clarity;
  return typeof fn === 'function' ? fn : undefined;
}

function dispatchGa4Event(
  eventName: string,
  params: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
    return;
  }

  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push({
    event: eventName,
    ...params,
  });
}

function resolveCurrentPagePath(): string | undefined {
  if (typeof window === 'undefined' || !window.location?.pathname) {
    return undefined;
  }
  return sanitizeUrlForAnalytics(window.location.pathname);
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

  // Microsoft Clarity — custom event tag (accepts event name only)
  if (!options?.skipClarity) {
    const clarity = getClarity();
    if (clarity) {
      clarity('event', event.name);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] trackEvent', event.name, gaParams, options);
  }
}

/**
 * Track initial page load and SPA route changes in GA4 via explicit `page_view` events.
 * Works in tandem with `{ send_page_view: false }` in `src/app/layout.tsx`.
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
    options?.title ??
    (typeof document !== 'undefined' ? document.title : undefined);
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
 * with the numeric `percent_scrolled` parameter (25 / 50 / 75 / 90).
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
 * Emits a standardized `button_click` event without leaking user PII.
 */
export function trackButtonClick({
  buttonId,
  location,
  destination,
  feature = 'navigation',
  metadata,
}: ButtonClickParams): void {
  const cleanButtonId = buttonId.trim();
  if (!cleanButtonId || containsSensitiveValue(cleanButtonId)) return;

  const currentPath = resolveCurrentPagePath();
  const safeExtra = sanitizeAnalyticsMetadata(metadata);

  const mergedMetadata: Record<string, string | number | boolean> = {
    ...safeExtra,
    button_id: cleanButtonId,
    ...(location?.trim() ? { button_location: location.trim() } : {}),
    ...(destination?.trim()
      ? { link_url: sanitizeUrlForAnalytics(destination) }
      : {}),
    ...(currentPath ? { page_path: currentPath } : {}),
  };

  trackEvent({
    name: 'button_click',
    feature,
    metadata: mergedMetadata,
  });
}

const VALID_ANALYTICS_FEATURES: ReadonlySet<string> = new Set<AnalyticsFeature>(
  [
    'auth',
    'onboarding',
    'mentor_pool',
    'profile',
    'reservation',
    'feedback',
    'performance',
    'navigation',
    'engagement',
  ]
);

function isAnalyticsFeature(value: string): value is AnalyticsFeature {
  return VALID_ANALYTICS_FEATURES.has(value);
}

/**
 * Extracts declarative `ButtonClickParams` from a DOM click target annotated with
 * `data-analytics-click="<button_id>"` (and optional `data-analytics-location` /
 * `data-analytics-feature`). Returns `null` if no active annotated ancestor exists.
 */
export function getAnalyticsClickPayloadFromElement(
  target: EventTarget | null
): ButtonClickParams | null {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return null;
  }

  const annotated = target.closest('[data-analytics-click]');
  if (!annotated) return null;

  if (
    annotated.hasAttribute('disabled') ||
    annotated.getAttribute('aria-disabled') === 'true'
  ) {
    return null;
  }

  const buttonId = annotated.getAttribute('data-analytics-click')?.trim() ?? '';
  if (!buttonId) return null;

  const location =
    annotated.getAttribute('data-analytics-location')?.trim() || undefined;
  const rawFeature =
    annotated.getAttribute('data-analytics-feature')?.trim() || '';
  const feature = isAnalyticsFeature(rawFeature) ? rawFeature : undefined;

  const anchor =
    annotated instanceof HTMLAnchorElement ? annotated : annotated.closest('a');
  const rawHref = anchor?.getAttribute('href')?.trim() ?? '';
  const destination =
    rawHref && rawHref !== '#' && !rawHref.startsWith('javascript:')
      ? sanitizeUrlForAnalytics(rawHref)
      : undefined;

  return {
    buttonId,
    ...(location ? { location } : {}),
    ...(destination ? { destination } : {}),
    ...(feature ? { feature } : {}),
  };
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
    containsSensitiveValue(value)
  ) {
    return;
  }
  const clarity = getClarity();
  if (!clarity) return;
  clarity('set', trimmedKey, value);
}

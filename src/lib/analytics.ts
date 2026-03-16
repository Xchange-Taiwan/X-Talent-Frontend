/**
 * Frontend Behavior Analytics
 *
 * Unified analytics layer that dispatches to both:
 *   - Microsoft Clarity  (session replay, heatmaps, custom events)
 *   - Google Analytics 4 (page views, funnel analysis, event reporting)
 *
 * ─── Initialization ────────────────────────────────────────────────────────────
 * GA4:     Initialized via <Script> in src/app/layout.tsx (gtag.js).
 * Clarity: Initialized via <Script> in src/app/layout.tsx (clarity snippet).
 * Both are gated by their respective env vars and are no-ops when absent.
 *
 * ─── How to add a new event ────────────────────────────────────────────────────
 * 1. Call trackEvent({ name: 'my_feature_action', feature: 'my_feature' })
 *    in the relevant hook or component.
 * 2. The event is automatically sent to both GA4 and Clarity.
 * 3. Use snake_case names in the format <feature>_<action>.
 *
 * ─── What must NEVER be sent ───────────────────────────────────────────────────
 * - Passwords or password hints
 * - Access tokens, refresh tokens, auth headers
 * - Raw email addresses or phone numbers
 * - Personal IDs or government ID numbers
 * - Any raw user-entered private content
 *
 * ─── Event naming convention ───────────────────────────────────────────────────
 * Format:  <feature>_<action>
 * Examples: sign_in_succeeded, onboarding_step_1_completed,
 *           reservation_booking_confirmed, profile_update_submitted
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * A structured behavior event for Clarity.
 * All fields are sent as Clarity custom events or session tags.
 */
export interface BehaviorEvent {
  /** snake_case event name — format: <feature>_<action> */
  name: string;
  /** Module or feature area this event belongs to */
  feature?: 'auth' | 'onboarding' | 'reservation' | 'profile';
  /**
   * Optional key-value metadata for additional context.
   * Do NOT include passwords, tokens, emails, or personal info.
   */
  metadata?: Record<string, string | number | boolean>;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

type ClarityFn = (...args: unknown[]) => void;

function getClarity(): ClarityFn | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!process.env.NEXT_PUBLIC_CLARITY_ID) return undefined;
  const fn = (window as Window & { clarity?: ClarityFn }).clarity;
  return typeof fn === 'function' ? fn : undefined;
}

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!process.env.NEXT_PUBLIC_GA_ID) return undefined;
  const fn = (window as Window & { gtag?: GtagFn }).gtag;
  return typeof fn === 'function' ? fn : undefined;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fires a named custom event to both GA4 and Clarity.
 *
 * GA4:     visible in Events report and usable in funnel/exploration reports.
 * Clarity: visible in Events tab and usable as a filter in recordings/heatmaps.
 *
 * Do NOT include passwords, tokens, emails, or personal info.
 */
export function trackEvent(event: BehaviorEvent): void {
  // — GA4 —
  const gtag = getGtag();
  if (gtag) {
    gtag('event', event.name, {
      ...(event.feature ? { feature: event.feature } : {}),
      ...event.metadata,
    });
  }

  // — Clarity —
  const clarity = getClarity();
  if (clarity) {
    clarity('event', event.name);
    if (event.feature) clarity('set', 'feature', event.feature);
    if (event.metadata) {
      for (const [key, value] of Object.entries(event.metadata)) {
        clarity('set', key, String(value));
      }
    }
  }

  // — Local dev debug —
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] trackEvent', event);
  }
}

/**
 * Tracks a page view in GA4.
 * Called automatically by PageViewTracker on every route change.
 * No need to call this manually.
 */
export function trackPageView(path: string): void {
  const gtag = getGtag();
  if (gtag) {
    gtag('config', process.env.NEXT_PUBLIC_GA_ID, { page_path: path });
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] trackPageView', path);
  }
}

/**
 * Sets a session-level custom tag in Clarity.
 * Tags persist for the session and can be used to filter recordings.
 *
 * Example: setAnalyticsTag('onboarding_step', '3')
 *
 * Do NOT use for sensitive data.
 */
export function setAnalyticsTag(key: string, value: string): void {
  const clarity = getClarity();
  if (!clarity) return;
  clarity('set', key, value);
}

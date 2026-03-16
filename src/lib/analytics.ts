/**
 * Frontend Behavior Analytics — Microsoft Clarity
 *
 * Wraps Clarity's custom event and tag API for lightweight behavior tracking
 * during the testing phase.
 *
 * What Clarity captures automatically (no code needed):
 *   - All page views
 *   - All clicks (heatmaps)
 *   - Scroll depth
 *   - Session replay
 *   - Rage clicks, dead clicks
 *
 * This module adds custom event markers and session tags on top, to make
 * important user flows filterable in Clarity dashboards and recordings.
 *
 * Gated by NEXT_PUBLIC_CLARITY_ID — runs in any environment where Clarity
 * is configured (e.g. testing). Silently no-ops when the env var is absent.
 *
 * NEVER pass passwords, tokens, emails, or any sensitive data to these functions.
 *
 * Event naming convention: <feature>_<action>
 * Examples: onboarding_step_1_completed, sign_in_succeeded, reservation_booking_confirmed
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

// ─── Internal helper ───────────────────────────────────────────────────────────

type ClarityFn = (...args: unknown[]) => void;

function getClarity(): ClarityFn | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!process.env.NEXT_PUBLIC_CLARITY_ID) return undefined;
  const fn = (window as Window & { clarity?: ClarityFn }).clarity;
  return typeof fn === 'function' ? fn : undefined;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fires a named custom event in Clarity.
 * Visible in Clarity → Events and usable as a filter in recordings / heatmaps.
 *
 * Do NOT include passwords, tokens, emails, or personal info.
 */
export function trackEvent(event: BehaviorEvent): void {
  const clarity = getClarity();
  if (!clarity) return;

  clarity('event', event.name);

  if (event.feature) {
    clarity('set', 'feature', event.feature);
  }

  if (event.metadata) {
    for (const [key, value] of Object.entries(event.metadata)) {
      clarity('set', key, String(value));
    }
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

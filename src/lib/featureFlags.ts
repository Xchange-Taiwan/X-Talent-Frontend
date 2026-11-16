export interface FeatureFlagEnvOverrides {
  rawValue?: string | undefined;
  nodeEnv?: string | undefined;
}

export interface FeatureFlagRuntimeOverrides {
  favorites?: boolean;
  feedback?: boolean;
}

declare global {
  interface Window {
    __E2E_FEATURE_FLAGS__?: FeatureFlagRuntimeOverrides;
  }
}

let runtimeOverrides: FeatureFlagRuntimeOverrides | null = null;

/**
 * Sets in-memory feature flag overrides for Storybook stories and isolated tests.
 * Pass `null` or call `resetFeatureFlagOverrides()` to restore default resolution.
 */
export function setFeatureFlagOverrides(
  overrides: FeatureFlagRuntimeOverrides | null
): void {
  runtimeOverrides = overrides ? { ...overrides } : null;
}

export function resetFeatureFlagOverrides(): void {
  runtimeOverrides = null;
}

/**
 * Resolves a boolean feature flag from a raw environment string:
 * - Explicit `'true'` / `'1'` (case-insensitive, trimmed) -> `true`
 * - Explicit `'false'` / `'0'` (case-insensitive, trimmed) -> `false`
 * - Unset, blank, or unrecognized values:
 *   - `nodeEnv === 'production'` -> `false` (Fail-Closed on production)
 *   - Otherwise (`development` / `test`) -> `true`
 */
export function resolveFeatureFlag(
  rawValue: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  const normalized =
    typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return nodeEnv === 'production' ? false : true;
}

function getNonProductionBrowserOverride(
  flag: keyof FeatureFlagRuntimeOverrides
): boolean | undefined {
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof window !== 'undefined' &&
    typeof window.__E2E_FEATURE_FLAGS__?.[flag] === 'boolean'
  ) {
    return window.__E2E_FEATURE_FLAGS__[flag];
  }
  return undefined;
}

/**
 * Controls the Mentor Favorites module (`107-mentor-favorites`).
 * Uses static dot access (`process.env.NEXT_PUBLIC_ENABLE_FAVORITES`) so Next.js
 * can inline the value into client bundles at build time.
 */
export function isFavoritesEnabled(
  overrides?: FeatureFlagEnvOverrides
): boolean {
  if (overrides !== undefined) {
    return resolveFeatureFlag(
      overrides.rawValue,
      overrides.nodeEnv ?? process.env.NODE_ENV
    );
  }

  if (runtimeOverrides?.favorites !== undefined) {
    return runtimeOverrides.favorites;
  }

  const browserOverride = getNonProductionBrowserOverride('favorites');
  if (browserOverride !== undefined) {
    return browserOverride;
  }

  return resolveFeatureFlag(
    process.env.NEXT_PUBLIC_ENABLE_FAVORITES,
    process.env.NODE_ENV
  );
}

/**
 * Controls the Meeting Feedback & Reviews module (`58-feedback-system`).
 * Uses static dot access (`process.env.NEXT_PUBLIC_ENABLE_FEEDBACK`) so Next.js
 * can inline the value into client bundles at build time.
 */
export function isFeedbackEnabled(
  overrides?: FeatureFlagEnvOverrides
): boolean {
  if (overrides !== undefined) {
    return resolveFeatureFlag(
      overrides.rawValue,
      overrides.nodeEnv ?? process.env.NODE_ENV
    );
  }

  if (runtimeOverrides?.feedback !== undefined) {
    return runtimeOverrides.feedback;
  }

  const browserOverride = getNonProductionBrowserOverride('feedback');
  if (browserOverride !== undefined) {
    return browserOverride;
  }

  return resolveFeatureFlag(
    process.env.NEXT_PUBLIC_ENABLE_FEEDBACK,
    process.env.NODE_ENV
  );
}

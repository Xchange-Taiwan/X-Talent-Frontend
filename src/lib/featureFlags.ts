export interface FeatureFlagEnvironment {
  sentryEnv?: string | undefined;
  vercelEnv?: string | undefined;
  apiUrl?: string | undefined;
  nodeEnv?: string | undefined;
}

const DEV_API_STAGE_SUFFIX_REGEX = /\/dev(?:\/api)?\/?$/i;

/**
 * Resolves a boolean feature flag from a raw environment string and runtime context:
 * 1. Explicit `'true'` / `'1'` (case-insensitive, trimmed) -> `true`
 * 2. Explicit `'false'` / `'0'` (case-insensitive, trimmed) -> `false`
 * 3. When unset or empty:
 *    - `sentryEnv === 'production'` -> `false` (Fail-Closed on production)
 *    - `nodeEnv !== 'production'` (local `pnpm dev` & Vitest) -> `true`
 *    - `sentryEnv === 'staging'` or `vercelEnv === 'preview'` -> `true`
 *    - `apiUrl` ending with `/dev` or `/dev/api` (`xtalentdev` & PR Previews) -> `true`
 *    - All other production builds (`xtalent` prod & local `pnpm build`) -> `false`
 */
export function resolveFeatureFlag(
  rawValue: string | undefined,
  env: FeatureFlagEnvironment = {}
): boolean {
  const normalized =
    typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  const sentryEnv = env.sentryEnv?.trim().toLowerCase();
  if (sentryEnv === 'production') {
    return false;
  }

  if (env.nodeEnv !== undefined && env.nodeEnv !== 'production') {
    return true;
  }

  const vercelEnv = env.vercelEnv?.trim().toLowerCase();
  if (sentryEnv === 'staging' || vercelEnv === 'preview') {
    return true;
  }

  const apiUrl = env.apiUrl?.trim() ?? '';
  if (apiUrl && DEV_API_STAGE_SUFFIX_REGEX.test(apiUrl)) {
    return true;
  }

  return false;
}

/**
 * Controls the Mentor Favorites module (`107-mentor-favorites`).
 * Reads `process.env.*` via literal static dot-property expressions on each call
 * so Next.js inlines values cleanly in client bundles while remaining testable via `vi.stubEnv`.
 */
export function isFavoritesEnabled(): boolean {
  return resolveFeatureFlag(process.env.NEXT_PUBLIC_ENABLE_FAVORITES, {
    sentryEnv: process.env.NEXT_PUBLIC_SENTRY_ENV,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

/**
 * Controls the Meeting Feedback & Reviews module (`58-meeting-feedback`).
 * Reads `process.env.*` via literal static dot-property expressions on each call
 * so Next.js inlines values cleanly in client bundles while remaining testable via `vi.stubEnv`.
 */
export function isFeedbackEnabled(): boolean {
  return resolveFeatureFlag(process.env.NEXT_PUBLIC_ENABLE_FEEDBACK, {
    sentryEnv: process.env.NEXT_PUBLIC_SENTRY_ENV,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

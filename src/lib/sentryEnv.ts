export interface SentryEnvInput {
  NEXT_PUBLIC_SENTRY_ENV?: string;
  NEXT_PUBLIC_VERCEL_ENV?: string;
  VERCEL_ENV?: string;
  readonly [key: string]: string | undefined;
}

export interface SentryRuntimeConfig {
  environment: string;
  enabled: boolean;
}

export const SENTRY_CLIENT_IGNORE_ERRORS: Array<string | RegExp> = [
  /Invalid call to runtime\.sendMessage\(\)/i,
  /Failed to execute 'removeChild' on 'Node'/i,
  /Failed to execute 'insertBefore' on 'Node'/i,
  /ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/i,
];

/**
 * Resolves the effective Sentry environment and enabled flag while preventing
 * Vercel preview/development deployments from polluting `production` when
 * `NEXT_PUBLIC_SENTRY_ENV=production` is inherited across environments.
 */
export function resolveSentryRuntimeConfig(
  env: SentryEnvInput = process.env
): SentryRuntimeConfig {
  const rawSentryEnv = env.NEXT_PUBLIC_SENTRY_ENV?.trim() || '';
  const vercelEnv = (env.NEXT_PUBLIC_VERCEL_ENV ?? env.VERCEL_ENV)?.trim();

  if (vercelEnv && vercelEnv !== 'production') {
    if (vercelEnv === 'preview') {
      const environment = rawSentryEnv === 'staging' ? 'staging' : 'preview';
      const enabled =
        rawSentryEnv === 'production' ||
        rawSentryEnv === 'staging' ||
        rawSentryEnv === 'preview';
      return { environment, enabled };
    }
    return { environment: 'local', enabled: false };
  }

  const environment = rawSentryEnv || 'local';
  const enabled = environment === 'production' || environment === 'staging';
  return { environment, enabled };
}

export interface LazyReplaySentryAdapter {
  lazyLoadIntegration: (
    name: 'replayIntegration'
  ) => Promise<(options?: Record<string, unknown>) => unknown>;
  addIntegration: (integration: unknown) => void;
}

/**
 * Lazily loads Sentry's `replayIntegration` without emitting unhandled promise
 * rejections when adblockers, CSP, or transient network errors block the CDN
 * bundle.
 */
export async function attachLazyReplayIntegration(
  sentry: LazyReplaySentryAdapter
): Promise<boolean> {
  try {
    const replayIntegration =
      await sentry.lazyLoadIntegration('replayIntegration');
    sentry.addIntegration(replayIntegration());
    return true;
  } catch {
    return false;
  }
}

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

/**
 * Resolves the effective Sentry environment and enabled flag while preventing
 * Vercel preview/development deployments from polluting `production` when
 * `NEXT_PUBLIC_SENTRY_ENV=production` is inherited across environments.
 *
 * Uses literal `process.env.NEXT_PUBLIC_*` dot-notation when `env` is omitted
 * so Next.js / Turbopack / Webpack statically inline the values in client and
 * edge bundles.
 */
export function resolveSentryRuntimeConfig(
  env?: SentryEnvInput
): SentryRuntimeConfig {
  const resolvedEnv: SentryEnvInput = env ?? {
    NEXT_PUBLIC_SENTRY_ENV: process.env.NEXT_PUBLIC_SENTRY_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  const rawSentryEnv = resolvedEnv.NEXT_PUBLIC_SENTRY_ENV?.trim() || '';
  const vercelEnv = (
    resolvedEnv.NEXT_PUBLIC_VERCEL_ENV ?? resolvedEnv.VERCEL_ENV
  )?.trim();

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

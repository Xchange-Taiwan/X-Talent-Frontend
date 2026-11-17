import { z } from 'zod';

const OptionalHttpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((val) => /^https?:\/\//i.test(val), {
    message: 'must be a valid http(s) URL',
  });

const ProductionEnvSchema = z.object({
  NEXTAUTH_SECRET: z
    .string()
    .min(16, 'must be at least 16 characters in production')
    .refine(
      (val) => val !== 'secret' && val !== 'changeme',
      'must not use placeholder values in production'
    ),
  NEXT_PUBLIC_API_URL: OptionalHttpUrlSchema.optional(),
  NEXT_PUBLIC_SITE_URL: OptionalHttpUrlSchema.optional(),
});

export function isLiveProductionEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.NEXT_PUBLIC_SENTRY_ENV === 'production';
}

export function validateRuntimeEnv(
  env: Record<string, string | undefined> = process.env
): void {
  if (!isLiveProductionEnv(env)) {
    return;
  }

  const parsed = ProductionEnvSchema.safeParse({
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ?? '',
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL || undefined,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL || undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid production environment configuration: ${details}`);
  }
}

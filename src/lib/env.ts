import { z } from 'zod';

import prodEnvValidator from '../../scripts/validate-prod-env.cjs';

const ProductionEnvMirrorSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(16),
});

export function validateRuntimeEnv(
  env: Record<string, string | undefined> = process.env
): void {
  prodEnvValidator.validateProductionEnv(env);
  if (prodEnvValidator.isLiveProductionEnv(env)) {
    ProductionEnvMirrorSchema.parse({
      NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ?? '',
    });
  }
}

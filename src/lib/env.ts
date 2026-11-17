import prodEnvValidator from '../../scripts/validate-prod-env.cjs';

export function isLiveProductionEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return prodEnvValidator.isLiveProductionEnv(env);
}

export function validateRuntimeEnv(
  env: Record<string, string | undefined> = process.env
): void {
  prodEnvValidator.validateProductionEnv(env);
}

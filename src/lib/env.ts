import {
  isLiveProductionEnv as checkLiveProductionEnv,
  validateProductionEnv,
} from './prodEnvCore.mjs';

export function isLiveProductionEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return checkLiveProductionEnv(env);
}

export function validateRuntimeEnv(
  env: Record<string, string | undefined> = process.env
): void {
  validateProductionEnv(env);
}

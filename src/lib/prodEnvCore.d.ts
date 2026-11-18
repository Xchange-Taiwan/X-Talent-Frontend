export function isValidHttpUrl(raw: string | undefined): boolean;
export function isLiveProductionEnv(
  env?: Record<string, string | undefined>
): boolean;
export function validateProductionEnv(
  env?: Record<string, string | undefined>
): void;

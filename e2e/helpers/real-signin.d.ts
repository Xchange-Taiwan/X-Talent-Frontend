import type { Page } from '@playwright/test';

export const DEFAULT_SIGNIN_MAX_ATTEMPTS = 3;
export const DEFAULT_SIGNIN_REDIRECT_TIMEOUT_MS = 25000;
export const DEFAULT_SIGNIN_RETRY_DELAY_MS = 1000;
export const SIGNIN_PATH = '/auth/signin';

export interface RealSignInOptions {
  email: string;
  password: string;
  maxAttempts?: number;
  redirectTimeoutMs?: number;
  retryDelayMs?: number;
  signInPath?: string;
}

export function isOnSignInPage(
  urlOrString: string | URL,
  signInPath?: string
): boolean;

export function redactSecretFromError(err: unknown, secret: string): Error;

export function realSignIn(
  page: Page,
  options: RealSignInOptions
): Promise<void>;

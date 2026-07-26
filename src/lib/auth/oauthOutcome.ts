import { signIn } from 'next-auth/react';

import { googleCallback } from '@/lib/actions/googleCallback';
import type { components } from '@/types/api';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];

export type OAuthOutcomeType =
  | 'LOGIN'
  | 'SIGNUP'
  | 'RESUME_DELETE_ACCOUNT'
  | 'INVALID';

export type OAuthOutcome =
  | { type: 'LOGIN'; data: GoogleCallbackVO }
  | { type: 'SIGNUP'; data: GoogleCallbackVO }
  | { type: 'RESUME_DELETE_ACCOUNT'; data: GoogleCallbackVO; email: string }
  | {
      type: 'INVALID';
      errorType: 'MISSING_PARAMS' | 'CALLBACK_FAILED' | 'DELETE_FLOW_INVALID';
    };

/**
 * Retrieves the pending delete account email from sessionStorage if it exists.
 * Does NOT clear sessionStorage to prevent state loss in React Strict Mode.
 */
export function getPendingDeleteAccountEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('delete_account_email');
}

/**
 * Clears the pending delete account email from sessionStorage.
 * Call this when actually starting/completing the deletion flow to prevent zombie states.
 */
export function clearPendingDeleteAccountEmail(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('delete_account_email');
}

/**
 * Unified helper for building signIn options and invoking NextAuth signIn
 * for the custom custom-google-token credentials provider.
 */
export async function signInWithGoogleToken(
  token: string,
  email: string,
  user: Record<string, unknown>
) {
  return signIn('custom-google-token', {
    redirect: false,
    token,
    email,
    user: JSON.stringify(user),
  });
}

/**
 * Resolves the Google OAuth callback response into a typed outcome.
 */
export async function resolveOAuthOutcome(
  code: string | null,
  state: string | null,
  options: { pendingDeleteAccountEmail?: string | null } = {}
): Promise<OAuthOutcome> {
  if (!code || !state) {
    return { type: 'INVALID', errorType: 'MISSING_PARAMS' };
  }

  try {
    const response = await googleCallback(code, state);
    const callbackData = response.data;

    if (!callbackData) {
      return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
    }

    const { pendingDeleteAccountEmail } = options;

    if (pendingDeleteAccountEmail) {
      if (callbackData.auth_type !== 'LOGIN') {
        return { type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' };
      }
      return {
        type: 'RESUME_DELETE_ACCOUNT',
        data: callbackData,
        email: pendingDeleteAccountEmail,
      };
    }

    if (callbackData.auth_type === 'SIGNUP') {
      return { type: 'SIGNUP', data: callbackData };
    }

    return { type: 'LOGIN', data: callbackData };
  } catch {
    return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
  }
}

import type { components } from '@/types/api';

import {
  clearPendingDeleteAccountEmail,
  getPendingDeleteAccountEmail,
} from './authFlowStorage';

export { clearPendingDeleteAccountEmail, getPendingDeleteAccountEmail };

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];
type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];

export type OAuthInvalidErrorType =
  'MISSING_PARAMS' | 'CALLBACK_FAILED' | 'DELETE_FLOW_INVALID';

export type OAuthOutcome =
  | { type: 'LOGIN'; data: GoogleCallbackVO }
  | { type: 'SIGNUP'; data: GoogleCallbackVO }
  | { type: 'RESUME_DELETE_ACCOUNT'; data: GoogleCallbackVO; email: string }
  | {
      type: 'INVALID';
      errorType: OAuthInvalidErrorType;
    };

export interface ClientSignInResult {
  error?: string | null;
  ok?: boolean;
}

export type ClientSignInFn = (
  provider: string,
  options?: Record<string, unknown>
) => Promise<ClientSignInResult | undefined>;

export type GoogleOAuthCodeExchanger = (
  code: string,
  state: string
) => Promise<OAuthCallbackResponse>;

export interface ResolveOAuthOutcomeOptions {
  exchangeCode: GoogleOAuthCodeExchanger;
  pendingDeleteAccountEmail?: string | null;
}

/**
 * Helper to sign in with NextAuth custom-google-token provider via injected
 * client signIn adapter (keeps src/lib/auth free of next-auth/react imports).
 */
export async function signInWithGoogleToken(
  signIn: ClientSignInFn,
  token: string,
  email: string,
  user: Record<string, unknown>
): Promise<void> {
  const res = await signIn('custom-google-token', {
    redirect: false,
    token,
    email,
    user: JSON.stringify(user),
  });

  if (res?.error) {
    throw new Error(res.error);
  }
}

/**
 * Resolves the state machine outcome of a Google OAuth callback via an
 * injected code-exchange adapter.
 */
export async function resolveOAuthOutcome(
  code: string | null,
  state: string | null,
  options: ResolveOAuthOutcomeOptions
): Promise<OAuthOutcome> {
  if (!code || !state) {
    return { type: 'INVALID', errorType: 'MISSING_PARAMS' };
  }

  try {
    const res = await options.exchangeCode(code, state);
    const callbackData = res?.data;

    if (!callbackData) {
      return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
    }

    if (options.pendingDeleteAccountEmail) {
      if (callbackData.auth_type === 'LOGIN') {
        return {
          type: 'RESUME_DELETE_ACCOUNT',
          data: callbackData,
          email: options.pendingDeleteAccountEmail,
        };
      }
      return { type: 'INVALID', errorType: 'DELETE_FLOW_INVALID' };
    }

    if (callbackData.auth_type === 'SIGNUP') {
      return { type: 'SIGNUP', data: callbackData };
    }

    return { type: 'LOGIN', data: callbackData };
  } catch {
    return { type: 'INVALID', errorType: 'CALLBACK_FAILED' };
  }
}

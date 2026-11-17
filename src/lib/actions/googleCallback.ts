'use server';

import { googleCallback as exchangeGoogleOAuthCode } from '@/actions/auth';
import type { OAuthCallbackResponse } from '@/lib/auth/bffSession.server';

export async function googleCallback(
  code: string,
  state: string
): Promise<OAuthCallbackResponse> {
  return exchangeGoogleOAuthCode(code, state);
}

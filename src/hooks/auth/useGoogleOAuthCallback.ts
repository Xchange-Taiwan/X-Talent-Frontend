import { useRouter, useSearchParams } from 'next/navigation';
import type { Session } from 'next-auth';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { googleCallback } from '@/lib/actions/googleCallback';
import {
  type PreExchangedGoogleOAuthResult,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import { executeGoogleOAuthCallback } from '@/lib/auth/sessionLifecycle';

function synthesizePreExchangedSession(
  preExchanged: PreExchangedGoogleOAuthResult
): Session | null {
  const callbackData = preExchanged.response.data;
  if (
    !callbackData ||
    callbackData.auth_type !== 'LOGIN' ||
    !callbackData.auth.token ||
    !callbackData.user
  ) {
    return null;
  }

  const { auth, user } = callbackData;
  return {
    accessToken: auth.token ?? undefined,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id:
        user.user_id !== undefined && user.user_id !== null
          ? String(user.user_id)
          : undefined,
      email: auth.email ?? undefined,
      name: user.name ?? undefined,
      avatar: user.avatar ?? undefined,
      onBoarding: user.onboarding ?? undefined,
      isMentor: user.is_mentor ?? undefined,
      jobTitle: user.job_title ?? undefined,
      company: user.company ?? undefined,
      personalLinks: [],
    },
  };
}

export function useGoogleOAuthCallback(
  initialPreExchanged?: PreExchangedGoogleOAuthResult | null
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const hasServerPreExchange =
      initialPreExchanged !== undefined && initialPreExchanged !== null;

    const handleOAuthFlow = async () => {
      try {
        await executeGoogleOAuthCallback(
          {
            code: hasServerPreExchange ? (code ?? 'server_exchanged') : code,
            state: hasServerPreExchange ? (state ?? 'server_exchanged') : state,
          },
          {
            exchangeCode: hasServerPreExchange
              ? async () => initialPreExchanged.response
              : googleCallback,
            signIn,
            signOut,
            getSession: hasServerPreExchange
              ? async () =>
                  synthesizePreExchangedSession(initialPreExchanged) ??
                  (await getSession())
              : getSession,
            signInWithGoogleTokenFn: hasServerPreExchange
              ? (clientSignIn, token, email, user) =>
                  signInWithGoogleToken(
                    clientSignIn,
                    token,
                    email,
                    user,
                    initialPreExchanged.refreshBridgeToken
                  )
              : undefined,
            revalidateAfterDelete: revalidateProfilePathAfterDelete,
            navigate: (href) => router.push(href),
            onToast: toast,
            currentOrigin:
              typeof window !== 'undefined'
                ? window.location.origin
                : undefined,
          }
        );
      } finally {
        setLoading(false);
      }
    };

    void handleOAuthFlow();
  }, [searchParams, router, toast, initialPreExchanged]);

  return { loading };
}

import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import {
  googleCallback,
  revalidateProfilePathAfterDelete,
} from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import {
  executeGoogleOAuthCallback,
  type PreExchangedGoogleOAuthResult,
  signInWithGoogleToken,
  synthesizePreExchangedSession,
} from '@/lib/auth/sessionLifecycle';

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

    const code = searchParams.get('code')?.trim() || null;
    const state = searchParams.get('state')?.trim() || null;
    const hasServerPreExchange =
      initialPreExchanged !== undefined && initialPreExchanged !== null;

    const handleOAuthFlow = async () => {
      try {
        await executeGoogleOAuthCallback(
          {
            code,
            state,
            preExchanged: hasServerPreExchange
              ? initialPreExchanged.response
              : undefined,
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

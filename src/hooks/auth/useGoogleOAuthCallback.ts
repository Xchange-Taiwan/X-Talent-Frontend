import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { googleCallback } from '@/lib/actions/googleCallback';
import { PENDING_AUTH_CALLBACK_URL_KEY } from '@/lib/auth/authFlowStorage';
import { executeGoogleOAuthCallback } from '@/lib/auth/sessionLifecycle';
import { resolvePostAuthRedirect } from '@/lib/favorites';
import { sanitizeCallbackUrl } from '@/lib/routes';

export function useGoogleOAuthCallback() {
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

    const handleOAuthFlow = async () => {
      try {
        const currentOrigin =
          typeof window !== 'undefined' ? window.location.origin : undefined;
        let loginExplicitCallbackUrl: string | null = null;
        let loginSession: Awaited<ReturnType<typeof getSession>> = null;

        await executeGoogleOAuthCallback(
          { code, state },
          {
            exchangeCode: googleCallback,
            signIn,
            signOut,
            getSession: async () => {
              try {
                const rawCallbackUrl =
                  typeof sessionStorage !== 'undefined'
                    ? sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
                    : null;
                loginExplicitCallbackUrl = sanitizeCallbackUrl(
                  rawCallbackUrl,
                  currentOrigin
                );
              } catch {
                loginExplicitCallbackUrl = null;
              }
              loginSession = await getSession();
              return loginSession;
            },
            revalidateAfterDelete: revalidateProfilePathAfterDelete,
            navigate: (href) => {
              if (loginSession?.accessToken && href !== '/auth/signin') {
                router.push(
                  resolvePostAuthRedirect({
                    explicitCallbackUrl: loginExplicitCallbackUrl,
                    isOnboarded: loginSession.user?.onBoarding !== false,
                  })
                );
                return;
              }
              router.push(href);
            },
            onToast: toast,
            currentOrigin,
          }
        );
      } finally {
        setLoading(false);
      }
    };

    void handleOAuthFlow();
  }, [searchParams, router, toast]);

  return { loading };
}

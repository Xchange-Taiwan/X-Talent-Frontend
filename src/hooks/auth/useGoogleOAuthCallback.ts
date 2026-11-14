import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { googleCallback } from '@/lib/actions/googleCallback';
import { consumePendingCallbackUrl } from '@/lib/auth/authFlowStorage';
import { executeGoogleOAuthCallback } from '@/lib/auth/sessionLifecycle';
import { resolvePostAuthRedirect } from '@/lib/favorites';

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
      const currentOrigin =
        typeof window !== 'undefined' ? window.location.origin : undefined;
      let explicitCallbackUrl: string | null = null;
      let isOnboarded: boolean | null = null;

      try {
        await executeGoogleOAuthCallback(
          { code, state },
          {
            exchangeCode: googleCallback,
            signIn,
            signOut,
            getSession: async () => {
              const currentSession = await getSession();
              if (currentSession?.accessToken) {
                explicitCallbackUrl = consumePendingCallbackUrl(currentOrigin);
                isOnboarded = currentSession.user?.onBoarding !== false;
              }
              return currentSession;
            },
            revalidateAfterDelete: revalidateProfilePathAfterDelete,
            navigate: (href) => {
              if (isOnboarded !== null) {
                router.push(
                  resolvePostAuthRedirect({
                    explicitCallbackUrl,
                    isOnboarded,
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

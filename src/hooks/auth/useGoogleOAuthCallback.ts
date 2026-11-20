import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import {
  googleCallback,
  revalidateProfilePathAfterDelete,
} from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import {
  authLifecycle,
  type PreExchangedGoogleOAuthResult,
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

    const handleOAuthFlow = async () => {
      try {
        await authLifecycle.handleGoogleOAuthCallback(
          {
            code: searchParams.get('code')?.trim() || null,
            state: searchParams.get('state')?.trim() || null,
            initialPreExchanged,
          },
          {
            exchangeGoogleCode: googleCallback,
            signIn,
            signOut,
            getSession,
            revalidateAfterDelete: revalidateProfilePathAfterDelete,
            navigate: (href) => router.push(href),
            toast,
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

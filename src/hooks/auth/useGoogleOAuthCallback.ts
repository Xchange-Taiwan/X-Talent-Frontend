import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import { useToast } from '@/components/ui/use-toast';
import { googleCallback } from '@/lib/actions/googleCallback';
import { executeGoogleOAuthCallback } from '@/lib/auth/sessionLifecycle';

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
        await executeGoogleOAuthCallback(
          { code, state },
          {
            exchangeCode: googleCallback,
            signIn,
            signOut,
            getSession,
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
  }, [searchParams, router, toast]);

  return { loading };
}

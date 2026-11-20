import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';

export function useConfirmRegister() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [status, setStatus] = useState<'loading' | 'success' | 'failure'>(() =>
    token ? 'loading' : 'failure'
  );

  const isMountedRef = useRef(true);
  const processedTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (processedTokenRef.current === token) {
      return;
    }
    processedTokenRef.current = token;
    setStatus(token ? 'loading' : 'failure');

    const confirmSignup = async () => {
      const result = await authLifecycle.confirmSignUp(token, {
        toast,
        isCurrent: () =>
          isMountedRef.current && processedTokenRef.current === token,
      });

      if (result.status === 'success') {
        setStatus('success');
      } else if (result.status === 'failure') {
        setStatus('failure');
      }
    };

    void confirmSignup();
  }, [token, toast]);

  return { status };
}

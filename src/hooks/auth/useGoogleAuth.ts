import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';

export function useGoogleAuth() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const inFlightRef = useRef(false);

  const handleGoogleAuth = async (isSignIn: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPending(true);
    let redirected = false;
    try {
      const result = await authLifecycle.startGoogleAuth(
        { isSignIn },
        {
          navigate: (url) => router.push(url),
          toast,
        }
      );
      redirected = result.ok;
    } finally {
      inFlightRef.current = false;
      if (!redirected) {
        setIsPending(false);
      }
    }
  };

  return {
    handleGoogleAuth,
    isPending,
  };
}

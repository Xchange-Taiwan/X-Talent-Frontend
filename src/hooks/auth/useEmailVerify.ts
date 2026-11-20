import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { HOME_HREF } from '@/lib/routes';

export function useEmailVerify() {
  const router = useRouter();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const inFlightRef = useRef(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = authLifecycle.getPendingVerificationEmail();
    if (!storedEmail) {
      router.push(HOME_HREF);
    } else {
      setEmail(storedEmail);
    }
  }, [router]);

  const handleResendEmail = async () => {
    if (!email || inFlightRef.current) return;
    inFlightRef.current = true;
    setIsResending(true);
    try {
      await authLifecycle.resendVerificationEmail(email, { toast });
    } finally {
      inFlightRef.current = false;
      setIsResending(false);
    }
  };

  const handleNavigateHome = () => {
    router.push(HOME_HREF);
  };

  return {
    email,
    isResending,
    handleResendEmail,
    handleNavigateHome,
  };
}

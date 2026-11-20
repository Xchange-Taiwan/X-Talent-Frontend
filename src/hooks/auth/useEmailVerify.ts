import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { HOME_HREF } from '@/lib/routes';

import { useAuthPendingAction } from './useAuthPendingAction';

export function useEmailVerify() {
  const router = useRouter();
  const { toast } = useToast();
  const { isPending: isResending, runPending } = useAuthPendingAction();
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
    if (!email) return;
    await runPending(() =>
      authLifecycle.resendVerificationEmail(email, { toast })
    );
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

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PASSWORD_FORGOT_HREF } from '@/lib/routes';

import { useAuthPendingAction } from './useAuthPendingAction';

export default function usePasswordResend() {
  const { isPending: isResending, runPending } = useAuthPendingAction();
  const [email, setEmail] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = authLifecycle.getPendingPasswordResetEmail();
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleResend = async () => {
    await runPending(() => authLifecycle.resendPasswordReset(email, { toast }));
  };

  const handleChangeEmail = () => {
    router.push(PASSWORD_FORGOT_HREF);
  };

  return { email, isResending, handleResend, handleChangeEmail };
}

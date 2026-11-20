import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { PASSWORD_FORGOT_HREF } from '@/lib/routes';

export default function usePasswordResend() {
  const [isResending, setIsResending] = useState(false);
  const inFlightRef = useRef(false);
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
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsResending(true);
    try {
      await authLifecycle.resendPasswordReset(email, { toast });
    } finally {
      inFlightRef.current = false;
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    router.push(PASSWORD_FORGOT_HREF);
  };

  return { email, isResending, handleResend, handleChangeEmail };
}

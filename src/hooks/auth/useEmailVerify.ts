import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import useAsyncAction from '@/hooks/useAsyncAction';
import { ApiError } from '@/lib/apiClient';
import { getPendingVerificationEmail } from '@/lib/auth/authFlowStorage';
import { resendVerificationEmailForPendingUser } from '@/lib/auth/sessionLifecycle';
import { HOME_HREF } from '@/lib/routes';

export function useEmailVerify() {
  const router = useRouter();
  const { toast } = useToast();
  const { run, isPending: isResending } = useAsyncAction();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = getPendingVerificationEmail();
    if (!storedEmail) {
      router.push(HOME_HREF);
    } else {
      setEmail(storedEmail);
    }
  }, [router]);

  const handleResendEmail = async () => {
    if (!email) return;

    await run(
      async () => {
        await resendVerificationEmailForPendingUser({ email });
        toast({
          variant: 'default',
          title: '已重新寄送',
          description: '驗證信已重新寄送！',
        });
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'email_verification',
          step: 'resend',
          level: 'info',
          errorCode: (err) =>
            err instanceof ApiError ? String(err.status) : undefined,
        },
        toastOnError: {
          title: '寄送失敗',
          description: (err) =>
            err instanceof Error ? err.message : '重新寄送失敗，請稍後再試。',
        },
      }
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

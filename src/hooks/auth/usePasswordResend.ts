import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import useAsyncAction from '@/hooks/useAsyncAction';
import { getPendingPasswordResetEmail } from '@/lib/auth/authFlowStorage';
import {
  PasswordResetLifecycleError,
  resendPasswordReset,
} from '@/lib/auth/sessionLifecycle';
import { getErrorMessage } from '@/lib/errorUtils';
import { PASSWORD_FORGOT_HREF } from '@/lib/routes';

export default function usePasswordResend() {
  const { run, isPending: isResending } = useAsyncAction();
  const [email, setEmail] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = getPendingPasswordResetEmail();
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleResend = async () => {
    await run(
      async () => {
        await resendPasswordReset({ email });
        toast({
          title: '已成功重新發送',
          description: '請至您的電子郵箱查看。',
        });
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'password_reset',
          step: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.step
              : 'resend_email',
          level: (err) =>
            err instanceof PasswordResetLifecycleError ? err.level : 'info',
          message: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.logMessage
              : getErrorMessage(err),
          errorCode: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.errorCode
              : undefined,
        },
        toastOnError: {
          title: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.title
              : '信件寄送失敗',
          description: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.message
              : getErrorMessage(err),
        },
      }
    );
  };

  const handleChangeEmail = () => {
    router.push(PASSWORD_FORGOT_HREF);
  };

  return { email, isResending, handleResend, handleChangeEmail };
}

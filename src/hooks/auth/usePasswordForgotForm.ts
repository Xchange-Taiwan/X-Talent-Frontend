import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import useAsyncAction from '@/hooks/useAsyncAction';
import {
  PasswordResetLifecycleError,
  requestPasswordReset,
} from '@/lib/auth/sessionLifecycle';
import { getErrorMessage } from '@/lib/errorUtils';
import { PasswordForgotSchema } from '@/schemas/auth';

type PasswordForgotValues = z.infer<typeof PasswordForgotSchema>;

export default function usePasswordForgotForm() {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const router = useRouter();

  const form = useForm<PasswordForgotValues>({
    resolver: zodResolver(PasswordForgotSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: PasswordForgotValues) => {
    await run(
      async () => {
        await requestPasswordReset(values.email, {
          navigate: (href) => router.push(href),
        });
      },
      {
        throwError: false,
        resetPendingOnSuccess: false,
        captureFailure: {
          flow: 'password_reset',
          step: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.step
              : 'request_email',
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

  return { form, isSubmitting, onSubmit };
}

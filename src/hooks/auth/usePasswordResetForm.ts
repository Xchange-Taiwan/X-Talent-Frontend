import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import useAsyncAction from '@/hooks/useAsyncAction';
import { ApiError } from '@/lib/apiClient';
import {
  completePasswordReset,
  PasswordResetLifecycleError,
} from '@/lib/auth/sessionLifecycle';
import { getErrorMessage } from '@/lib/errorUtils';
import { PasswordResetSchema } from '@/schemas/auth';

type PasswordResetValues = z.infer<typeof PasswordResetSchema>;

export default function usePasswordResetForm() {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (values: PasswordResetValues) => {
    const verifyToken = searchParams.get('token');

    await run(
      async () => {
        await completePasswordReset(
          {
            verifyToken,
            password: values.password,
            confirmPassword: values.confirm_password,
          },
          {
            navigate: (href) => router.push(href),
          }
        );
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'password_reset',
          step: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.step
              : 'submit_new_password',
          level: (err) =>
            err instanceof PasswordResetLifecycleError ? err.level : 'info',
          message: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.logMessage
              : getErrorMessage(err),
          errorCode: (err) =>
            err instanceof ApiError ? String(err.status) : undefined,
        },
        toastOnError: {
          title: (err) =>
            err instanceof PasswordResetLifecycleError
              ? err.title
              : '密碼重設失敗',
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

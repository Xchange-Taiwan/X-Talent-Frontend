import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import useAsyncAction from '@/hooks/useAsyncAction';
import { ApiError } from '@/lib/apiClient';
import { requestPasswordReset } from '@/lib/auth/sessionLifecycle';
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
          step: 'request_email',
          level: 'info',
          errorCode: (err) =>
            err instanceof ApiError ? String(err.status) : undefined,
        },
        toastOnError: {
          title: '信件寄送失敗',
          description: (err) =>
            err instanceof Error ? err.message : '發生錯誤，請稍後再試。',
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

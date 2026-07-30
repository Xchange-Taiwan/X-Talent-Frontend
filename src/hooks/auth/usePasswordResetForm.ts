import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import useAsyncAction from '@/hooks/useAsyncAction';
import { PasswordResetSchema } from '@/schemas/auth';
import { resetPassword } from '@/services/auth/resetPassword';
import { AuthResponse } from '@/services/types';

type PasswordResetValues = z.infer<typeof PasswordResetSchema>;

export default function usePasswordResetForm() {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const form = useForm<PasswordResetValues>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: {
      password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (values: PasswordResetValues) => {
    const verifyToken = searchParams.get('token');

    if (!verifyToken) {
      toast({
        variant: 'destructive',
        title: '驗證失敗',
        description: '缺少驗證 Token，請重新申請密碼重設。',
      });
      return;
    }

    await run(
      async () => {
        await resetPassword(
          verifyToken,
          values.password,
          values.confirm_password
        );
        router.push('/auth/password-reset-success');
      },
      {
        toastOnError: {
          title: '密碼重設失敗',
          description: (error) => {
            const err = error as AuthResponse;
            return err.message || '發生錯誤，請稍後再試。';
          },
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

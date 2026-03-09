import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { PasswordResetSchema } from '@/schemas/auth';
import { resetPassword } from '@/services/auth/resetPassword';
import { AuthResponse } from '@/services/types';

type PasswordResetValues = z.infer<typeof PasswordResetSchema>;

export default function usePasswordResetForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    setIsSubmitting(true);

    try {
      await resetPassword(
        verifyToken,
        values.password,
        values.confirm_password
      );
      router.push('/auth/password-reset-success');
    } catch (error) {
      const err = error as AuthResponse;
      toast({
        variant: 'destructive',
        title: '密碼重設失敗',
        description: err.message || '發生錯誤，請稍後再試。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}

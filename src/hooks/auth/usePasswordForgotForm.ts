import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { PasswordForgotSchema } from '@/schemas/auth';
import { resetPassword } from '@/services/auth/resetPasswordByEmail';
import { AuthResponse } from '@/services/types';

type PasswordForgotValues = z.infer<typeof PasswordForgotSchema>;

export default function usePasswordForgotForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<PasswordForgotValues>({
    resolver: zodResolver(PasswordForgotSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: PasswordForgotValues) => {
    setIsSubmitting(true);

    try {
      const response = await resetPassword(values.email);
      if (response.code === 200) {
        sessionStorage.setItem('pending_reset_email', values.email);
        router.push('/auth/password-forgot-success');
      } else {
        // Non-200 response — manually reset the submitting state
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
      const err = error as AuthResponse;
      toast({
        variant: 'destructive',
        title: '信件寄送失敗',
        description: err.message || '發生錯誤，請稍後再試。',
      });
    }
  };

  return { form, isSubmitting, onSubmit };
}

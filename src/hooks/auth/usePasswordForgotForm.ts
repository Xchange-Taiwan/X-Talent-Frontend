import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { setPendingPasswordResetEmail } from '@/lib/auth/authFlowStorage';
import { PASSWORD_FORGOT_SUCCESS_HREF } from '@/lib/routes';
import { PasswordForgotSchema } from '@/schemas/auth';
import { resetPassword } from '@/services/auth/resetPasswordByEmail';

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
      await resetPassword(values.email);
      setPendingPasswordResetEmail(values.email);
      router.push(PASSWORD_FORGOT_SUCCESS_HREF);
    } catch (error) {
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: '信件寄送失敗',
        description:
          error instanceof Error ? error.message : '發生錯誤，請稍後再試。',
      });
    }
  };

  return { form, isSubmitting, onSubmit };
}

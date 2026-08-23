import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { SignUpSchema } from '@/schemas/auth';
import { signUp } from '@/services/auth/signUp';

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function useSignUpForm(): AuthFormProps<SignUpValues> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Fire once when the sign-up form mounts — user has reached the sign-up page
  useEffect(() => {
    trackEvent({ name: 'sign_up_started', feature: 'auth' });
  }, []);

  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      hasReadTermsOfService: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof SignUpSchema>) => {
    setIsSubmitting(true);

    try {
      await signUp(values);
      trackEvent({ name: 'sign_up_succeeded', feature: 'auth' });
      sessionStorage.setItem('email', values.email);
      router.push('/auth/email-verify');
    } catch (error) {
      captureFlowFailure({
        flow: 'sign_up',
        step: 'submit',
        message:
          error instanceof Error ? error.message : 'Unexpected sign-up error',
        errorCode: error instanceof ApiError ? String(error.status) : undefined,
        level: 'info',
      });

      if (error instanceof ApiError) {
        if (error.status === 422) {
          toast({
            variant: 'destructive',
            title: '驗證失敗',
            description:
              error.message || '驗證錯誤。請確保所有欄位均正確填寫。',
          });
        } else if (error.status === 406) {
          toast({
            variant: 'destructive',
            title: '註冊失敗',
            description:
              error.message || '此電子郵件已被註冊。請使用其他電子郵件或登錄。',
          });
        } else if (error.status === 429) {
          toast({
            variant: 'destructive',
            title: '請求過於頻繁',
            description:
              error.message || '您已超出最大註冊嘗試次數。請稍後再試。',
          });
        } else {
          toast({
            variant: 'destructive',
            title: '註冊失敗',
            description: `${error.message || '發生錯誤。'} - HTTP狀態碼: ${error.status}。`,
          });
        }
      } else {
        toast({
          variant: 'destructive',
          title: '註冊失敗',
          description:
            error instanceof Error ? error.message : '系統錯誤，請稍後再試',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}

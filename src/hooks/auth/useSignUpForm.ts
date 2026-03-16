import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { SignUpSchema } from '@/schemas/auth';
import { signUp } from '@/services/auth/signUp';
import { AuthResponse } from '@/services/types';

import { handleSignUpError } from '../../services/auth/signUpErrorHandler';
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
      const result = await signUp(values);

      if (result.status === 'success') {
        trackEvent({ name: 'sign_up_succeeded', feature: 'auth' });
        sessionStorage.setItem('email', values.email);
        router.push('/auth/email-verify');
        return;
      }
    } catch (error) {
      captureFlowFailure({
        flow: 'sign_up',
        step: 'submit',
        message:
          error instanceof Error ? error.message : 'Unexpected sign-up error',
        errorCode: (error as AuthResponse)?.code,
      });
      handleSignUpError(error as AuthResponse, toast);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, isSubmitting, onSubmit };
}

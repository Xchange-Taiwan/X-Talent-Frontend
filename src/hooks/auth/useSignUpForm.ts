import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { SignUpSchema } from '@/schemas/auth';

import { useAuthPendingAction } from './useAuthPendingAction';

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function useSignUpForm(): AuthFormProps<SignUpValues> {
  const { isPending: isSubmitting, runPending } = useAuthPendingAction();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    authLifecycle.trackSignUpStarted();
  }, []);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm_password: '',
      hasReadTermsOfService: false,
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    await runPending(
      () =>
        authLifecycle.signUpWithCredentials(values, {
          navigate: (href) => router.push(href),
          toast,
        }),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return { form, isSubmitting, onSubmit };
}

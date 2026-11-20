import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import { authLifecycle } from '@/lib/auth/sessionLifecycle';
import { SignInSchema } from '@/schemas/auth';

import { useAuthPendingAction } from './useAuthPendingAction';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const { isPending: isSubmitting, runPending } = useAuthPendingAction();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInValues) => {
    await runPending(
      () =>
        authLifecycle.signInWithCredentials(values, {
          signIn: clientSignIn,
          getSession,
          navigate: (href) => router.push(href),
          toast,
        }),
      { keepPendingWhen: (result) => result.ok }
    );
  };

  return { form, isSubmitting, onSubmit };
}

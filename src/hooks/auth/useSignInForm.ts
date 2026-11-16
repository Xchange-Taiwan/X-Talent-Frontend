import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import useAsyncAction from '@/hooks/useAsyncAction';
import {
  SignInLifecycleError,
  signInWithCredentials,
} from '@/lib/auth/sessionLifecycle';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const router = useRouter();

  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInValues) => {
    await run(
      async () => {
        await signInWithCredentials(values, {
          signIn: clientSignIn,
          getSession,
          navigate: (href) => router.push(href),
          search: typeof window !== 'undefined' ? window.location.search : '',
          currentOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        });
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'sign_in',
          step: (err) =>
            err instanceof SignInLifecycleError ? err.step : 'unexpected',
          level: (err) =>
            err instanceof SignInLifecycleError ? err.level : 'error',
          message: (err) =>
            err instanceof SignInLifecycleError
              ? err.logMessage
              : err instanceof Error
                ? err.message
                : 'Unexpected sign-in error',
          errorCode: (err) =>
            err instanceof SignInLifecycleError ? err.errorCode : undefined,
        },
        toastOnError: {
          description: (err) =>
            err instanceof SignInLifecycleError
              ? err.message
              : 'Something went wrong!',
          duration: (err) =>
            err instanceof SignInLifecycleError ? 1000 : undefined,
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

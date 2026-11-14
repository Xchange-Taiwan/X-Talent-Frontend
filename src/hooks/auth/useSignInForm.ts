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
import { resolvePostAuthRedirect } from '@/lib/favorites';
import { sanitizeCallbackUrl } from '@/lib/routes';
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
        const search =
          typeof window !== 'undefined' ? window.location.search : '';
        const currentOrigin =
          typeof window !== 'undefined' ? window.location.origin : undefined;
        const explicitCallbackUrl = sanitizeCallbackUrl(
          search ? new URLSearchParams(search).get('callbackUrl') : null,
          currentOrigin
        );
        let isOnboarded: boolean | null = null;

        await signInWithCredentials(values, {
          signIn: clientSignIn,
          getSession: async () => {
            const currentSession = await getSession();
            if (currentSession?.accessToken) {
              isOnboarded = currentSession.user?.onBoarding !== false;
            }
            return currentSession;
          },
          navigate: (href) => {
            if (isOnboarded !== null) {
              router.push(
                resolvePostAuthRedirect({
                  explicitCallbackUrl,
                  isOnboarded,
                })
              );
              return;
            }
            router.push(href);
          },
          search,
          currentOrigin,
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

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import useAsyncAction from '@/hooks/useAsyncAction';
import { validateSignIn } from '@/lib/actions/signIn';
import { trackEvent } from '@/lib/analytics';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

class SignInError extends Error {
  constructor(
    message: string,
    public step: string,
    public logMessage: string,
    public level: 'info' | 'warning' | 'error' = 'info'
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

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
        const validated = await validateSignIn(values);
        if (validated.error) {
          throw new SignInError(
            validated.error,
            'validate_credentials',
            validated.error,
            'info'
          );
        }

        const login = await clientSignIn('credentials', {
          email: validated.email,
          password: validated.password,
          redirect: false,
        });

        if (login?.error) {
          throw new SignInError(
            'Invalid credentials!',
            'authenticate',
            'Invalid credentials',
            'info'
          );
        }

        const session = await getSession();
        if (!session?.accessToken) {
          throw new SignInError(
            'Login failed',
            'get_session',
            'No access token after login',
            'error'
          );
        }

        trackEvent({ name: 'sign_in_succeeded', feature: 'auth' });

        if (session.user.onBoarding === false) {
          router.push('/auth/onboarding');
        } else {
          router.push('/mentor-pool');
        }
      },
      {
        captureFailure: {
          flow: 'sign_in',
          step: (err) => (err instanceof SignInError ? err.step : 'unexpected'),
          level: (err) => (err instanceof SignInError ? err.level : 'error'),
          message: (err) =>
            err instanceof SignInError
              ? err.logMessage
              : err instanceof Error
                ? err.message
                : 'Unexpected sign-in error',
        },
        toastOnError: {
          description: (err) =>
            err instanceof SignInError ? err.message : 'Something went wrong!',
          duration: (err) => (err instanceof SignInError ? 1000 : undefined),
        },
        onError: (err) => {
          if (!(err instanceof SignInError)) {
            console.error(
              '[SignIn] unexpected error:',
              err instanceof Error ? err.message : 'Unexpected sign-in error'
            );
          }
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

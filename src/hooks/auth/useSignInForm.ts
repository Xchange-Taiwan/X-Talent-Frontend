import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import useAsyncAction from '@/hooks/useAsyncAction';
import { validateSignIn } from '@/lib/actions/signIn';
import {
  resolveAnalyticsUserRole,
  setAnalyticsUserContext,
  trackEvent,
} from '@/lib/analytics';
import {
  clearPendingCallbackUrl,
  sanitizeCallbackUrl,
} from '@/lib/auth/callbackUrl';
import { resolvePostAuthRedirect } from '@/lib/favorites';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

class SignInError extends Error {
  constructor(
    message: string,
    public step: string,
    public logMessage: string,
    public level: 'info' | 'warning' | 'error' = 'info',
    public errorCode?: string
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
            'info',
            login.error
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

        const userRole = resolveAnalyticsUserRole(session.user);
        setAnalyticsUserContext({
          userId: session.user?.id ?? null,
          userRole,
        });
        trackEvent({
          name: 'login',
          feature: 'auth',
          metadata: {
            method: 'Email',
            user_role: userRole,
          },
        });

        clearPendingCallbackUrl();
        const rawCallbackUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('callbackUrl')
            : null;
        const safeCallbackUrl = sanitizeCallbackUrl(
          rawCallbackUrl,
          typeof window !== 'undefined' ? window.location.origin : undefined
        );

        router.push(
          resolvePostAuthRedirect({
            explicitCallbackUrl: safeCallbackUrl,
            isOnboarded: session.user.onBoarding !== false,
          })
        );
      },
      {
        throwError: false,
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
          errorCode: (err) =>
            err instanceof SignInError ? err.errorCode : undefined,
        },
        toastOnError: {
          description: (err) =>
            err instanceof SignInError ? err.message : 'Something went wrong!',
          duration: (err) => (err instanceof SignInError ? 1000 : undefined),
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

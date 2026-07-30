import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { getSession, signIn as clientSignIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import { useToast } from '@/components/ui/use-toast';
import useAsyncAction from '@/hooks/useAsyncAction';
import { validateSignIn } from '@/lib/actions/signIn';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function useSignInForm(): AuthFormProps<SignInValues> {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const { toast } = useToast();
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
          captureFlowFailure({
            flow: 'sign_in',
            step: 'validate_credentials',
            message: validated.error,
            level: 'info',
          });
          toast({
            variant: 'destructive',
            description: validated.error,
            duration: 1000,
          });
          return;
        }

        const login = await clientSignIn('credentials', {
          email: validated.email,
          password: validated.password,
          redirect: false,
        });

        if (login?.error) {
          captureFlowFailure({
            flow: 'sign_in',
            step: 'authenticate',
            message: 'Invalid credentials',
            errorCode: login.error,
            level: 'info',
          });
          toast({
            variant: 'destructive',
            description: 'Invalid credentials!',
            duration: 1000,
          });
          return;
        }

        const session = await getSession();
        if (!session?.accessToken) {
          captureFlowFailure({
            flow: 'sign_in',
            step: 'get_session',
            message: 'No access token after login',
          });
          toast({
            variant: 'destructive',
            description: 'Login failed',
            duration: 1000,
          });
          return;
        }

        trackEvent({ name: 'sign_in_succeeded', feature: 'auth' });

        if (session.user.onBoarding === false) {
          router.push('/auth/onboarding');
        } else {
          router.push('/mentor-pool');
        }
      },
      {
        throwError: false,
        captureFailure: {
          flow: 'sign_in',
          step: 'unexpected',
          message: (err) =>
            err instanceof Error ? err.message : 'Unexpected sign-in error',
        },
        toastOnError: {
          description: 'Something went wrong!',
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

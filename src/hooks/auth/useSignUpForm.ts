import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { AuthFormProps } from '@/components/auth/types';
import useAsyncAction from '@/hooks/useAsyncAction';
import { trackEvent } from '@/lib/analytics';
import {
  SignUpLifecycleError,
  signUpWithCredentials,
} from '@/lib/auth/sessionLifecycle';
import { SignUpSchema } from '@/schemas/auth';

type SignUpValues = z.infer<typeof SignUpSchema>;

export default function useSignUpForm(): AuthFormProps<SignUpValues> {
  const { run, isPending: isSubmitting } = useAsyncAction();
  const router = useRouter();

  // Fire once when the sign-up form mounts — user has reached the sign-up page
  useEffect(() => {
    trackEvent({ name: 'sign_up_started', feature: 'auth' });
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
    await run(
      async () => {
        await signUpWithCredentials(values, {
          navigate: (href) => router.push(href),
        });
      },
      {
        throwError: false,
        resetPendingOnSuccess: false,
        onError: (err) => {
          trackEvent({
            name: 'auth_flow_failed',
            feature: 'auth',
            metadata: {
              flow: 'sign_up',
              error_type:
                err instanceof SignUpLifecycleError &&
                err.errorCode !== undefined
                  ? String(err.errorCode)
                  : 'submit_failed',
            },
          });
        },
        captureFailure: {
          flow: 'sign_up',
          step: 'submit',
          level: (err) =>
            err instanceof SignUpLifecycleError ? err.level : 'info',
          message: (err) =>
            err instanceof SignUpLifecycleError
              ? err.logMessage
              : err instanceof Error
                ? err.message
                : 'Unexpected sign-up error',
          errorCode: (err) =>
            err instanceof SignUpLifecycleError ? err.errorCode : undefined,
        },
        toastOnError: {
          title: (err) =>
            err instanceof SignUpLifecycleError ? err.title : '註冊失敗',
          description: (err) =>
            err instanceof SignUpLifecycleError
              ? err.message
              : err instanceof Error
                ? err.message
                : '系統錯誤，請稍後再試',
        },
      }
    );
  };

  return { form, isSubmitting, onSubmit };
}

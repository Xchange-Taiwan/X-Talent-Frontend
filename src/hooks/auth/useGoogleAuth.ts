import { useRouter } from 'next/navigation';

import useAsyncAction from '@/hooks/useAsyncAction';
import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { initiateGoogleAuth } from '@/lib/auth/sessionLifecycle';

export function useGoogleAuth() {
  const router = useRouter();
  const { run, isPending } = useAsyncAction();

  const handleGoogleAuth = async (isSignIn: boolean) => {
    await run(
      async () => {
        trackEvent({
          name: 'auth_oauth_started',
          feature: 'auth',
          metadata: {
            method: 'Google',
            flow: isSignIn ? 'login' : 'sign_up',
          },
        });
        await initiateGoogleAuth(
          isSignIn
            ? {
                intent: 'login',
                search:
                  typeof window !== 'undefined' ? window.location.search : '',
                currentOrigin:
                  typeof window !== 'undefined'
                    ? window.location.origin
                    : undefined,
              }
            : { intent: 'signup' },
          {
            navigate: (url) => router.push(url),
          }
        );
      },
      {
        throwError: false,
        resetPendingOnSuccess: false,
        captureFailure: {
          flow: 'google_oauth',
          step: isSignIn ? 'authorize_login' : 'authorize_signup',
          level: 'warning',
          errorCode: (err) =>
            err instanceof ApiError ? String(err.status) : undefined,
        },
        toastOnError: {
          title: isSignIn ? '登入失敗' : '註冊失敗',
          description: isSignIn
            ? '無法完成 Google 登入，請稍後再試。'
            : '無法完成 Google 註冊，請稍後再試。',
        },
      }
    );
  };

  return {
    handleGoogleAuth,
    isPending,
  };
}

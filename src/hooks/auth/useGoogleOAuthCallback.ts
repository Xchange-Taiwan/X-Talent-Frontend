import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { revalidateProfilePathAfterDelete } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import {
  clearPendingDeleteAccountEmail,
  getPendingDeleteAccountEmail,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import { deleteAccount } from '@/services/auth/deleteAccount';
import type { components } from '@/types/api';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];

export function useGoogleOAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const executeInvalid = (
      errorType: 'MISSING_PARAMS' | 'CALLBACK_FAILED' | 'DELETE_FLOW_INVALID'
    ) => {
      // Clear the delete email marker on any invalid path to prevent zombie landmine states
      clearPendingDeleteAccountEmail();

      const description =
        errorType === 'MISSING_PARAMS'
          ? 'Authorization failed. Please try again.'
          : errorType === 'DELETE_FLOW_INVALID'
            ? '無法取得 Google 憑證，請稍後再試'
            : 'Something went wrong during login.';

      const title =
        errorType === 'MISSING_PARAMS'
          ? 'Missing Google OAuth parameters'
          : errorType === 'DELETE_FLOW_INVALID'
            ? '刪除帳號失敗'
            : 'Login failed';

      toast({
        variant: 'destructive',
        title,
        description,
      });
      router.push('/auth/signin');
    };

    const executeSignup = (data: GoogleCallbackVO) => {
      sessionStorage.setItem('email', data.auth.email ?? '');
      router.push('/auth/email-verify');
    };

    const executeLogin = async (data: GoogleCallbackVO) => {
      if (!data.user || !data.auth.token) {
        toast({
          variant: 'destructive',
          title: 'Missing login data',
          description: 'OAuth response is missing required fields.',
        });
        router.push('/auth/signin');
        return;
      }

      await signInWithGoogleToken(
        data.auth.token,
        data.auth.email ?? '',
        data.user
      );

      const session = await getSession();

      if (session?.user?.onBoarding === false) {
        router.push('/auth/onboarding');
      } else {
        router.push('/mentor-pool');
      }
    };

    const executeResumeDeleteAccount = async (
      data: GoogleCallbackVO,
      email: string
    ) => {
      // Safe clearance of sessionStorage at the absolute top of execution to prevent zombie states
      clearPendingDeleteAccountEmail();

      const { id_token, auth, user } = data;

      if (!id_token || !auth.token || !user) {
        toast({
          variant: 'destructive',
          title: '刪除帳號失敗',
          description: '無法取得 Google 憑證，請稍後再試',
        });
        router.push('/auth/signin');
        return;
      }

      await signInWithGoogleToken(auth.token, auth.email ?? '', user);

      const result = await deleteAccount({ email, id_token });

      if (result.status === 'success') {
        trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
        if (user?.user_id) {
          await revalidateProfilePathAfterDelete(
            String(user.user_id),
            user.name ?? undefined
          );
        }
        await signOut({ callbackUrl: '/' });
        return;
      }

      if (result.status === 'blocked_reservations') {
        toast({
          variant: 'destructive',
          title: '無法刪除帳號',
          description: '您目前有未完成或未來的預約，請先處理後再刪除帳號。',
        });
        router.push('/reservation/mentee');
        return;
      }

      toast({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description: result.message || '系統錯誤，請稍後再試',
      });
      router.push('/auth/signin');
    };

    const handleOAuthFlow = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      const pendingDeleteAccountEmail = getPendingDeleteAccountEmail();
      const outcome = await resolveOAuthOutcome(code, state, {
        pendingDeleteAccountEmail,
      });

      try {
        switch (outcome.type) {
          case 'INVALID':
            executeInvalid(outcome.errorType);
            break;
          case 'SIGNUP':
            executeSignup(outcome.data);
            break;
          case 'LOGIN':
            await executeLogin(outcome.data);
            break;
          case 'RESUME_DELETE_ACCOUNT':
            await executeResumeDeleteAccount(outcome.data, outcome.email);
            break;
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: 'Something went wrong during login.',
        });
        router.push('/auth/signin');
      } finally {
        setLoading(false);
      }
    };

    handleOAuthFlow();
  }, [searchParams, router, toast]);

  return { loading };
}

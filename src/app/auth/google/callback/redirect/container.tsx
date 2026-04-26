'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { googleCallback } from '@/lib/actions/googleCallback';
import { trackEvent } from '@/lib/analytics';
import { deleteAccount } from '@/services/auth/deleteAccount';
import type { components } from '@/types/api';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];

export default function GoogleOAuthRedirectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOAuthFlow = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        toast({
          variant: 'destructive',
          title: 'Missing Google OAuth parameters',
          description: 'Authorization failed. Please try again.',
        });
        router.push('/auth/signin');
        return;
      }

      try {
        const response = await googleCallback(code, state);
        console.log('[Google OAuth] backend response:', response);

        const callbackData = response.data;
        if (!callbackData) {
          toast({
            variant: 'destructive',
            title: 'Login failed',
            description: 'Something went wrong during login.',
          });
          router.push('/auth/signin');
          return;
        }

        const refreshToken = response.refreshToken;

        const deleteEmail = sessionStorage.getItem('delete_account_email');
        if (deleteEmail) {
          sessionStorage.removeItem('delete_account_email');
          await handleDeleteAccountFlow(
            callbackData,
            deleteEmail,
            refreshToken
          );
          return;
        }

        await proceedWithSignIn(callbackData, refreshToken);
      } catch (err) {
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
  }, []);

  const handleDeleteAccountFlow = async (
    data: GoogleCallbackVO,
    email: string,
    refreshToken: string | null
  ) => {
    if (data.auth_type !== 'LOGIN') {
      toast({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description: '無法取得 Google 憑證，請稍後再試',
      });
      router.push('/auth/signin');
      return;
    }

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

    await signIn('custom-google-token', {
      redirect: false,
      token: auth.token,
      email: auth.email ?? '',
      user: JSON.stringify(user),
      refreshToken: refreshToken ?? '',
    });

    const result = await deleteAccount({ email, id_token });

    if (result.status === 'success') {
      trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
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

  const proceedWithSignIn = async (
    data: GoogleCallbackVO,
    refreshToken: string | null
  ) => {
    if (data.auth_type === 'SIGNUP') {
      sessionStorage.setItem('email', data.auth.email ?? '');
      router.push('/auth/email-verify');
      return;
    }

    if (!data.user || !data.auth.token) {
      toast({
        variant: 'destructive',
        title: 'Missing login data',
        description: 'OAuth response is missing required fields.',
      });
      router.push('/auth/signin');
      return;
    }

    await signIn('custom-google-token', {
      redirect: false,
      token: data.auth.token,
      email: data.auth.email ?? '',
      user: JSON.stringify(data.user),
      refreshToken: refreshToken ?? '',
    });

    const session = await getSession();

    if (session?.user?.onBoarding === false) {
      router.push('/auth/onboarding');
    } else {
      router.push('/mentor-pool');
    }
  };

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-3">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">
        {loading ? 'Signing you in with Google...' : 'Redirecting...'}
      </p>
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
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

      console.log('[GoogleAuth] redirect page mounted', {
        code,
        state,
        fullUrl: window.location.href,
      });

      if (!code || !state) {
        console.warn('[GoogleAuth] missing code or state in URL');
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
        console.log(
          '[GoogleAuth] googleCallback returned (full response):',
          JSON.stringify(response, null, 2)
        );

        const callbackData = response.data;
        if (!callbackData) {
          console.warn('[GoogleAuth] callback response has no data');
          toast({
            variant: 'destructive',
            title: 'Login failed',
            description: 'Something went wrong during login.',
          });
          router.push('/auth/signin');
          return;
        }

        const deleteEmail = sessionStorage.getItem('delete_account_email');
        if (deleteEmail) {
          console.log(
            '[GoogleAuth] delete_account_email present, entering delete flow'
          );
          sessionStorage.removeItem('delete_account_email');
          await handleDeleteAccountFlow(callbackData, deleteEmail);
          return;
        }

        await proceedWithSignIn(callbackData);
      } catch (err) {
        console.error('[GoogleAuth] handleOAuthFlow error:', err);
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
    email: string
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
    });

    const result = await deleteAccount({ email, id_token });

    if (result.status === 'success') {
      trackEvent({ name: 'delete_account_succeeded', feature: 'auth' });
      if (user?.user_id) {
        await revalidateProfilePath(String(user.user_id));
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

  const proceedWithSignIn = async (data: GoogleCallbackVO) => {
    console.log(
      '[GoogleAuth] proceedWithSignIn data (full):',
      JSON.stringify(data, null, 2)
    );
    console.log('[GoogleAuth] proceedWithSignIn auth.token:', data.auth?.token);
    console.log('[GoogleAuth] proceedWithSignIn id_token:', data.id_token);
    console.log('[GoogleAuth] proceedWithSignIn user:', data.user);

    if (data.auth_type === 'SIGNUP') {
      console.log('[GoogleAuth] SIGNUP flow → redirect to /auth/email-verify');
      sessionStorage.setItem('email', data.auth.email ?? '');
      router.push('/auth/email-verify');
      return;
    }

    if (!data.user || !data.auth.token) {
      console.warn('[GoogleAuth] LOGIN flow missing user or auth token', {
        user: data.user,
        authToken: data.auth?.token,
      });
      toast({
        variant: 'destructive',
        title: 'Missing login data',
        description: 'OAuth response is missing required fields.',
      });
      router.push('/auth/signin');
      return;
    }

    console.log('[GoogleAuth] calling signIn with:', {
      token: data.auth.token,
      email: data.auth.email ?? '',
      user: data.user,
    });
    const signInResult = await signIn('custom-google-token', {
      redirect: false,
      token: data.auth.token,
      email: data.auth.email ?? '',
      user: JSON.stringify(data.user),
    });
    console.log(
      '[GoogleAuth] custom-google-token signIn result (full):',
      JSON.stringify(signInResult, null, 2)
    );

    const session = await getSession();
    console.log(
      '[GoogleAuth] session after signIn (full):',
      JSON.stringify(session, null, 2)
    );

    if (session?.user?.onBoarding === false) {
      console.log('[GoogleAuth] onBoarding=false → /auth/onboarding');
      router.push('/auth/onboarding');
    } else {
      console.log('[GoogleAuth] onBoarding=true → /mentor-pool');
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

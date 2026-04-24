'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { deleteAccount } from '@/services/auth/deleteAccount';

type OAuthUser = {
  user_id: number | string;
  name: string;
  avatar: string;
  is_mentor: boolean;
  onboarding: boolean;
  job_title?: string;
  company?: string;
  years_of_experience?: string;
  location?: string;
  interested_positions?: string[] | null;
  skills?: string[] | null;
  topics?: string[] | null;
  industry?: string | null;
  language?: string;
};

type SignupResponse = {
  code: string;
  msg: string;
  data: {
    auth_type: 'SIGNUP';
    ttl_secs: number;
    auth: {
      email: string;
      token: string;
    };
  };
};

type LoginResponse = {
  code: string;
  msg: string;
  data: {
    auth_type: 'LOGIN';
    auth: {
      user_id: number | string;
      token: string;
    };
    user: OAuthUser;
    id_token?: string | null;
  };
};

type OAuthResponse = SignupResponse | LoginResponse;

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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v2/oauth/google/callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          }
        );

        const data: OAuthResponse = await res.json();
        console.log('[Google OAuth] backend response:', data);

        const deleteEmail = sessionStorage.getItem('delete_account_email');
        if (deleteEmail) {
          sessionStorage.removeItem('delete_account_email');
          await handleDeleteAccountFlow(data, deleteEmail);
          return;
        }

        await proceedWithSignIn(data);
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
    data: OAuthResponse,
    email: string
  ) => {
    const id_token =
      data.data.auth_type === 'LOGIN' ? data.data.id_token : null;

    if (!id_token) {
      toast({
        variant: 'destructive',
        title: '刪除帳號失敗',
        description: '無法取得 Google 憑證，請稍後再試',
      });
      router.push('/auth/signin');
      return;
    }

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

  const proceedWithSignIn = async (data: OAuthResponse) => {
    const backendData = data.data;

    // SIGNUP — go to email verification
    if (backendData.auth_type === 'SIGNUP') {
      sessionStorage.setItem('email', backendData.auth.email);
      router.push('/auth/email-verify');
      return;
    }

    // LOGIN — must have user + token
    if (!('user' in backendData) || !backendData.auth?.token) {
      toast({
        variant: 'destructive',
        title: 'Missing login data',
        description: 'OAuth response is missing required fields.',
      });
      router.push('/auth/signin');
      return;
    }

    const token = backendData.auth.token;
    const user = backendData.user;

    await signIn('custom-google-token', {
      redirect: false,
      token,
      user: JSON.stringify(user),
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

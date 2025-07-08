'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

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
    token: string;
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

      // 🔁 Workaround for NextAuth issue:
      // In v5.0.0-beta.4, calling `signIn` with `{ redirect: false }` causes the page to crash,
      // and calling `signIn` without it causes a full page reload.
      //
      // To avoid both issues, we temporarily store the backend OAuth response in `localStorage`,
      // and defer session-based routing until `getSession()` confirms the user is logged in.
      const cached = localStorage.getItem('google_oauth_data');
      if (cached) {
        console.log('[OAuth Debug] Found cached OAuth data');
        try {
          const session = await getSession();
          console.log('[OAuth Debug] session:', session);

          localStorage.removeItem('google_oauth_data');

          if (session?.user?.onBoarding === false) {
            router.push('/auth/onboarding');
          } else {
            router.push('/mentorPool');
          }

          return;
        } catch (err) {
          console.error('Failed to parse cached OAuth data:', err);
          localStorage.removeItem('google_oauth_data');
        }
      }

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
        console.log(
          '[OAuth Debug] Sending POST to /v2/oauth/google/callback...',
        );
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v2/oauth/google/callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          },
        );

        const data: OAuthResponse = await res.json();
        console.log('[OAuth Debug] Response from backend:', data);

        localStorage.setItem('google_oauth_data', JSON.stringify(data));
        proceedWithSignIn(data);
      } catch (err) {
        console.error('[OAuth Debug] OAuth login failed:', err);
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

  const proceedWithSignIn = async (data: OAuthResponse) => {
    const backendData = data?.data;

    if (backendData.auth_type === 'SIGNUP') {
      router.push('/auth/emailVerify');
      return;
    }

    if (!backendData || !backendData.user || !backendData.auth?.token) {
      toast({
        variant: 'destructive',
        title: 'Missing login data',
        description: 'OAuth response is missing required fields.',
      });

      console.log('');
      router.push('/auth/signin');
      return;
    }

    const token = backendData.auth.token;
    const user = backendData.user;

    // ⚠️ NextAuth (v5.0.0-beta.4) limitation:
    // `signIn('credentials', { redirect: false })` crashes
    // `signIn('credentials')` triggers unwanted page reload
    //
    // So we accept the reload here temporarily, relying on the localStorage workaround above.
    await signIn('custom-google-token', {
      token,
      user: JSON.stringify(user),
    });
  };

  return (
    <div>{loading ? 'Signing you in with Google...' : 'Redirecting...'}</div>
  );
}

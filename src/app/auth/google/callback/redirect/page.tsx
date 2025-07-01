'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

export default function GoogleOAuthRedirectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (hasRun) return;
    setHasRun(true);

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('[OAuth Debug] code:', code);
    console.log('[OAuth Debug] state:', state);

    if (!code || !state) {
      toast({
        variant: 'destructive',
        title: 'Missing Google OAuth parameters',
        description: 'Authorization failed. Please try again.',
      });
      router.push('/auth/signin');
      return;
    }

    const handleGoogleOAuth = async () => {
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

        const data = await res.json();
        console.log('[OAuth Debug] Response from backend:', data);

        const backendData = data?.data || {};

        const auth_type: string | undefined = backendData.auth_type;
        console.log('[OAuth Debug] auth_type:', auth_type);

        if (auth_type === 'SIGNUP') {
          console.log('[OAuth Debug] Redirecting to email verification...');
          router.push('/auth/emailVerify');
          return;
        }

        const token: string | undefined = backendData.auth?.token;
        const user = backendData.user;

        console.log('[OAuth Debug] token:', token);
        console.log('[OAuth Debug] user:', user);

        if (!token) {
          throw new Error('Missing token in OAuth response.');
        }

        const cleanedUser = {
          user_id: user?.user_id || '',
          name: user?.name || '',
          avatar: user?.avatar || '',
          is_mentor: user?.is_mentor ?? false,
          onboarding: user?.onboarding ?? false,
        };

        console.log('[OAuth Debug] cleanedUser:', cleanedUser);

        const result = await signIn('custom-google-token', {
          redirect: false,
          token,
          user: JSON.stringify(cleanedUser),
        });

        console.log('[OAuth Debug] signIn result:', result);

        if (result?.error) {
          throw new Error(result.error);
        }

        const session = await getSession();
        console.log('[OAuth Debug] session:', session);

        if (session?.user?.onBoarding === false) {
          console.log('[OAuth Debug] Redirecting to onboarding...');
          router.push('/auth/onboarding');
        } else {
          console.log('[OAuth Debug] Redirecting to mentorPool...');
          router.push('/mentorPool');
        }
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

    handleGoogleOAuth();
  }, [searchParams, router, toast]);

  return (
    <div>{loading ? 'Signing you in with Google...' : 'Redirecting...'}</div>
  );
}

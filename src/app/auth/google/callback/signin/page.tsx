'use client';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { handleSignUpError } from '@/services/auth/signUpErrorHandler';
import { AuthResponse } from '@/services/types';

export default function Page() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const doSignIn = async () => {
      const session = await getSession();

      const user = session?.user;
      const googleAccessToken = session?.googleAccessToken;

      if (!user?.oauthId || !googleAccessToken) {
        if (!session?.accessToken || session?.accessToken.length === 0) {
          toast({
            variant: 'destructive',
            description: 'Login failed: User data is missing',
            duration: 1000,
          });
          return;
        }

        if (session?.user.onBoarding === false) {
          router.push('/auth/onboarding');
        } else {
          router.push('/mentorlist');
        }

        return;
      }

      try {
        await signIn('credentials-google-oauth', {
          access_token: googleAccessToken,
          oauth_id: user.oauthId,
          language: 'zh_TW',
        });
      } catch (err) {
        const error = err as AuthResponse;

        if (error?.message) {
          setMessage(error.message);
        } else {
          setMessage('Unknown error occurred');
        }

        handleSignUpError(error as AuthResponse, toast);
      } finally {
        setIsLoading(false);
      }
    };

    doSignIn();
  }, []);

  if (isLoading) {
    return <div className="text-center">驗證中，請稍候...</div>;
  }

  if (message) {
    return <div className="text-center">{message}</div>;
  }
}

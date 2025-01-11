'use client';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

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
            description: 'Login failed',
            duration: 1000,
          });
          if (user?.msg) {
            setMessage(user.msg);
          } else {
            setMessage('Unknown error occurred');
          }
          return;
        }

        if (session?.user.onBoarding === false) {
          router.push('/auth/onboarding');
        } else {
          router.push('/mentorlist');
        }
        return;
      }

      if (user?.name) {
        sessionStorage.setItem('name', user.name);
      }

      if (user?.avatar) {
        sessionStorage.setItem('avatar', user.avatar);
      }

      try {
        await signIn('credentials-google-oauth', {
          access_token: googleAccessToken,
          oauth_id: user.oauthId,
          language: 'zh_TW',
        });
      } catch (err) {
        const error = err as Error;
        console.error(error);

        if (error) {
          setMessage(error.message);
        } else {
          setMessage('Unknown error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    doSignIn();
  }, []);

  if (message) {
    return <div className="text-center">{message}</div>;
  }

  if (isLoading) {
    return <div className="text-center">驗證中，請稍候...</div>;
  }
}

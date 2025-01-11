'use client';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { googleSignUp, GoogleSignUpType } from '@/services/auth/googleSignUp';
import { handleSignUpError } from '@/services/auth/signUpErrorHandler';
import { AuthResponse } from '@/services/types';

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signup');
      return;
    }

    const doSignUp = async () => {
      const user = session?.user;
      const googleAccessToken = session?.googleAccessToken;

      if (!user?.email || !user?.oauthId || !googleAccessToken) {
        router.push('/auth/signup');
        return;
      }

      const googleSignUpBody: GoogleSignUpType = {
        email: user.email,
        oauth_id: user.oauthId as string,
        access_token: googleAccessToken,
      };

      try {
        const result = await googleSignUp(googleSignUpBody);

        if (result.status === 'success') {
          sessionStorage.setItem('email', googleSignUpBody.email);
          router.push('/auth/emailVerify');
        }
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

    doSignUp();
  }, [status]);

  if (message) {
    return <div className="text-center">{message}</div>;
  }

  if (isLoading) {
    return <div className="text-center">驗證中，請稍候...</div>;
  }
}

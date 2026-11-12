import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  clearPendingSignInCallbackUrl,
  setPendingSignInCallbackUrl,
} from '@/lib/auth/callbackUrl';
import {
  getGoogleAuthorizeLoginUrl,
  getGoogleAuthorizeSignupUrl,
} from '@/services/auth/googleAuthorize';

export function useGoogleAuth() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const handleGoogleAuth = async (isSignIn: boolean) => {
    setIsPending(true);
    try {
      if (isSignIn && typeof window !== 'undefined') {
        const rawCallbackUrl = new URLSearchParams(window.location.search).get(
          'callbackUrl'
        );
        setPendingSignInCallbackUrl(rawCallbackUrl);
      } else {
        clearPendingSignInCallbackUrl();
      }
      const { authorization_url } = isSignIn
        ? await getGoogleAuthorizeLoginUrl()
        : await getGoogleAuthorizeSignupUrl();
      router.push(authorization_url);
    } catch {
      clearPendingSignInCallbackUrl();
      toast({
        variant: 'destructive',
        title: isSignIn ? '登入失敗' : '註冊失敗',
        description: isSignIn
          ? '無法完成 Google 登入，請稍後再試。'
          : '無法完成 Google 註冊，請稍後再試。',
      });
      setIsPending(false);
    }
  };

  return {
    handleGoogleAuth,
    isPending,
  };
}

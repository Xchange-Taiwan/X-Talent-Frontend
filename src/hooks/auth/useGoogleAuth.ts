import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  consumePostLoginCallbackUrl,
  savePostLoginCallbackUrl,
} from '@/lib/url/resolveSafeCallbackUrl';
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
      if (typeof window !== 'undefined') {
        if (isSignIn) {
          const currentParams = new URLSearchParams(window.location.search);
          savePostLoginCallbackUrl(currentParams.get('callbackUrl'));
        } else {
          consumePostLoginCallbackUrl();
        }
      }
      const { authorization_url } = isSignIn
        ? await getGoogleAuthorizeLoginUrl()
        : await getGoogleAuthorizeSignupUrl();
      router.push(authorization_url);
    } catch {
      consumePostLoginCallbackUrl();
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

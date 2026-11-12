import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import {
  clearPendingCallbackUrl,
  persistPendingCallbackUrlFromSearch,
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
      const { authorization_url } = isSignIn
        ? await getGoogleAuthorizeLoginUrl()
        : await getGoogleAuthorizeSignupUrl();
      if (typeof window !== 'undefined') {
        if (isSignIn) {
          persistPendingCallbackUrlFromSearch(
            window.location.search,
            window.location.origin
          );
        } else {
          clearPendingCallbackUrl();
        }
      }
      router.push(authorization_url);
    } catch {
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

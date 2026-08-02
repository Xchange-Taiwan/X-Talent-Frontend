import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
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
      router.push(authorization_url);
    } catch {
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      });
    } finally {
      setIsPending(false);
    }
  };

  return {
    handleGoogleAuth,
    isPending,
  };
}

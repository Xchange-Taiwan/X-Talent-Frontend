'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AuthTitle from '@/components/auth/AuthTitle';
import Divider from '@/components/auth/Divider';
import GoogleSignUpButton from '@/components/auth/GoogleButton';
import SignInForm from '@/components/auth/signin/SignInForm';
import { useToast } from '@/components/ui/use-toast';
import useSignInForm from '@/hooks/auth/useSignInForm';
import { trackEvent } from '@/lib/analytics';
import {
  clearLastGoogleLoginHint,
  type LastGoogleLoginHint,
  readLastGoogleLoginHint,
} from '@/lib/lastGoogleLoginHint';
import { getGoogleAuthorizeLoginUrl } from '@/services/auth/googleAuthorize';

export default function Page() {
  const signInFormProps = useSignInForm();
  const router = useRouter();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState<LastGoogleLoginHint | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    setHint(readLastGoogleLoginHint());
    setMounted(true);
  }, []);

  const handleSwitchAccount = async (): Promise<void> => {
    if (isSwitching) return;
    setIsSwitching(true);
    clearLastGoogleLoginHint();
    setHint(null);
    trackEvent({
      name: 'google_switch_account_clicked',
      feature: 'auth',
      metadata: { has_hint: true },
    });
    try {
      const { authorization_url } = await getGoogleAuthorizeLoginUrl();
      const sep = authorization_url.includes('?') ? '&' : '?';
      router.push(`${authorization_url}${sep}prompt=select_account`);
    } catch (error) {
      console.error('[GoogleAuth] switch account error:', error);
      setIsSwitching(false);
      toast({
        variant: 'destructive',
        title: '登入失敗',
        description: '無法完成 Google 登入，請稍後再試。',
      });
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 pb-8 sm:pb-0">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <AuthTitle>登入 X-Talent 帳戶</AuthTitle>
        <SignInForm {...signInFormProps} />
        <Divider>或</Divider>
        {mounted ? (
          <div className="flex flex-col items-center gap-3">
            <GoogleSignUpButton
              isSubmitting={signInFormProps.isSubmitting || isSwitching}
              label="使用 Google 帳號登入"
              isSignIn={true}
              hint={hint}
            />
            {hint ? (
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={isSwitching}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
              >
                使用其他 Google 帳號
              </button>
            ) : null}
          </div>
        ) : (
          <div
            aria-hidden
            className="h-12 w-full rounded-full border border-input bg-background"
          />
        )}
      </div>
    </div>
  );
}

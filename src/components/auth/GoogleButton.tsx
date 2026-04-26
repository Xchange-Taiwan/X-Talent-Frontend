'use client';

import { useRouter } from 'next/navigation';

import { GoogleColor } from '@/components/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { type LastGoogleLoginHint, maskEmail } from '@/lib/lastGoogleLoginHint';
import {
  getGoogleAuthorizeLoginUrl,
  getGoogleAuthorizeSignupUrl,
} from '@/services/auth/googleAuthorize';

interface GoogleSignUpButtonProps {
  isSubmitting: boolean;
  isSignIn: boolean;
  label: string;
  hint?: LastGoogleLoginHint | null;
}

function appendQueryParams(
  url: string,
  params: Record<string, string>
): string {
  const entries = Object.entries(params).filter(([, v]) => v.length > 0);
  if (entries.length === 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${url}${sep}${qs}`;
}

export default function GoogleSignUpButton({
  isSubmitting,
  label,
  isSignIn,
  hint = null,
}: GoogleSignUpButtonProps) {
  const { toast } = useToast();
  const router = useRouter();

  const showPersonalized = isSignIn && !!hint;

  const handleClick = async () => {
    try {
      const { authorization_url } = isSignIn
        ? await getGoogleAuthorizeLoginUrl()
        : await getGoogleAuthorizeSignupUrl();

      const extra: Record<string, string> = {};
      if (hint?.email) {
        extra.login_hint = hint.email;
      }

      if (isSignIn) {
        trackEvent({
          name: 'google_oneclick_clicked',
          feature: 'auth',
          metadata: { has_hint: !!hint },
        });
      }

      router.push(appendQueryParams(authorization_url, extra));
    } catch (error) {
      console.error('[GoogleAuth] error:', error);
      toast({
        variant: 'destructive',
        title: isSignIn ? '登入失敗' : '註冊失敗',
        description: isSignIn
          ? '無法完成 Google 登入，請稍後再試。'
          : '無法完成 Google 註冊，請稍後再試。',
      });
    }
  };

  if (showPersonalized && hint) {
    const displayName = hint.name?.trim() || hint.email.split('@')[0];
    const masked = maskEmail(hint.email);
    return (
      <Button
        variant="outline"
        className="h-12 w-full justify-start gap-3 rounded-full px-4"
        disabled={isSubmitting}
        onClick={handleClick}
        aria-label={`以 ${displayName} (${masked}) 繼續`}
      >
        <Avatar className="h-7 w-7 shrink-0">
          {hint.avatar ? <AvatarImage src={hint.avatar} alt="" /> : null}
          <AvatarFallback>
            <GoogleColor className="text-base" />
          </AvatarFallback>
        </Avatar>
        <span className="flex flex-1 flex-col items-start text-left leading-tight">
          <span className="text-sm font-medium">以 {displayName} 繼續</span>
          <span className="text-xs text-muted-foreground">{masked}</span>
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-full"
      disabled={isSubmitting}
      onClick={handleClick}
    >
      <GoogleColor className="mr-3 text-xl" />
      <span className="text-base">{label}</span>
    </Button>
  );
}

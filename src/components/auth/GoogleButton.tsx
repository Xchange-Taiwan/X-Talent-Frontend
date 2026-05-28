import { useRouter } from 'next/navigation';

import { GoogleColor } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  getGoogleAuthorizeLoginUrl,
  getGoogleAuthorizeSignupUrl,
} from '@/services/auth/googleAuthorize';

interface GoogleSignUpButtonProps {
  isSubmitting: boolean;
  isSignIn: boolean;
  label: string;
}

export default function GoogleSignUpButton({
  isSubmitting,
  label,
  isSignIn,
}: GoogleSignUpButtonProps) {
  const { toast } = useToast();
  const router = useRouter();

  const handleGoogleSignUp = async () => {
    console.log('[GoogleAuth] button clicked', {
      mode: isSignIn ? 'login' : 'signup',
    });
    try {
      const { authorization_url } = isSignIn
        ? await getGoogleAuthorizeLoginUrl()
        : await getGoogleAuthorizeSignupUrl();
      console.log('[GoogleAuth] authorize URL received', {
        mode: isSignIn ? 'login' : 'signup',
        authorization_url,
      });
      router.push(authorization_url);
    } catch (error) {
      console.error('[GoogleAuth] authorize error:', error);
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      });
    }
  };

  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-full"
      disabled={isSubmitting}
      onClick={handleGoogleSignUp}
    >
      <GoogleColor className="mr-3 text-xl" />
      <span className="text-base">{label}</span>
    </Button>
  );
}

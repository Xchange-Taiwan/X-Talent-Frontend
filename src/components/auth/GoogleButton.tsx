import { signIn } from 'next-auth/react';

import { GoogleColor } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

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

  const handleGoogleSignUp = async () => {
    try {
      await signIn('google', {
        callbackUrl: isSignIn
          ? '/auth/google/callback/signin'
          : '/auth/google/callback/signup',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      });
      return;
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

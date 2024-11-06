import { signIn } from 'next-auth/react';

import { GoogleColor } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface GoogleSignUpButtonProps {
  isSubmitting: boolean;
}

export default function GoogleSignUpButton({
  isSubmitting,
}: GoogleSignUpButtonProps) {
  const { toast } = useToast();

  const handleGoogleSignUp = async () => {
    try {
      await signIn('google');
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
      <span className="text-base">使用 Google 帳號註冊</span>
    </Button>
  );
}

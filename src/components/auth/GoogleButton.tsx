import React from 'react';

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

  const handleGoogleSignUp = () => {
    toast({
      variant: 'default',
      title: '註冊成功',
      description: '請前往您的電子郵件信箱驗證您的帳號',
    });
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

'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { resendVerificationEmail } from '@/services/resend/resend';

const EmailVerificationPage = dynamic(() => import('./ui'));

export default function EmailVerificationContainer() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('email');
    if (!storedEmail) {
      router.push('/');
    } else {
      setEmail(storedEmail);
    }
  }, [router]);

  const handleResendEmail = async () => {
    if (!email) return;

    try {
      await resendVerificationEmail(email);
      toast({
        variant: 'default',
        title: '已重新寄送',
        description: '驗證信已重新寄送！',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '寄送失敗',
        description:
          error instanceof Error ? error.message : '重新寄送失敗，請稍後再試。',
      });
    }
  };

  const handleNavigateHome = () => {
    router.push('/');
  };

  if (!email) {
    return null;
  }

  return (
    <EmailVerificationPage
      onResendEmail={handleResendEmail}
      onNavigateHome={handleNavigateHome}
    />
  );
}

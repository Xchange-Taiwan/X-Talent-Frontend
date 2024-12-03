'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { confirmRegister } from '@/services/auth/confirmRegister';

const EmailVerifiedPresentation = dynamic(() => import('./ui'));

export default function EmailVerifiedContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/');
      return;
    }

    const confirmSignup = async () => {
      try {
        await confirmRegister(token);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '註冊失敗',
          description:
            error instanceof Error ? error.message : '註冊失敗，請稍後再試。',
        });
        router.push('/auth/signup');
      } finally {
        setIsLoading(false);
      }
    };

    confirmSignup();
  }, [token, router, toast]);

  if (isLoading) {
    return <div className="text-center">驗證中，請稍候...</div>;
  }

  return (
    <EmailVerifiedPresentation
      onSetProfile={() => router.push('/auth/onboarding')}
    />
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import EmailVerifiedFailuredIconUrl from '@/assets/auth/email-verified-failed-icon.svg';
import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';
import { useToast } from '@/components/ui/use-toast';
import { confirmRegister } from '@/services/auth/confirmRegister';

const EmailVerifiedPresentation = dynamic(() => import('./ui'));

export default function EmailVerifiedContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [icon, setIcon] = useState(EmailVerifiedIconUrl.src);
  const [title, setTitle] = useState('驗證成功');
  const [content, setContent] = useState(
    '你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！'
  );
  const [btnContent, setBtnContent] = useState('設定個人資訊');
  const [redirectUrl, setRedirectUrl] = useState('/auth/signin');

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

        setIcon(EmailVerifiedFailuredIconUrl.src);
        setTitle('驗證失敗');
        setContent('您的驗證連結已失效，請重新輸入Email再次驗證');
        setBtnContent('返回重試');
        setRedirectUrl('/auth/signup');
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
      icon={icon}
      onSetProfile={() => router.push(redirectUrl)}
      title={title}
      content={content}
      btnContent={btnContent}
    />
  );
}

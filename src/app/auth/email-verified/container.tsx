'use client';

import { useRouter } from 'next/navigation';

import EmailVerifiedFailuredIconUrl from '@/assets/auth/email-verified-failed-icon.svg';
import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';
import { useConfirmRegister } from '@/hooks/auth/useConfirmRegister';
import { SIGNIN_HREF, SIGNUP_HREF } from '@/lib/routes';

import EmailVerifiedPresentation, { EmailVerifiedLoadingCard } from './ui';

export default function EmailVerifiedContainer() {
  const router = useRouter();
  const { status } = useConfirmRegister();

  if (status === 'loading') {
    return <EmailVerifiedLoadingCard />;
  }

  const uiContent = {
    success: {
      icon:
        typeof EmailVerifiedIconUrl === 'string'
          ? EmailVerifiedIconUrl
          : EmailVerifiedIconUrl.src,
      title: '驗證成功',
      content:
        '你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！',
      btnContent: '設定個人資訊',
      redirectUrl: SIGNIN_HREF,
    },
    failure: {
      icon:
        typeof EmailVerifiedFailuredIconUrl === 'string'
          ? EmailVerifiedFailuredIconUrl
          : EmailVerifiedFailuredIconUrl.src,
      title: '驗證失敗',
      content: '您的驗證連結已失效，請重新輸入Email再次驗證',
      btnContent: '返回重試',
      redirectUrl: SIGNUP_HREF,
    },
  };

  const { icon, title, content, btnContent, redirectUrl } = uiContent[status];

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

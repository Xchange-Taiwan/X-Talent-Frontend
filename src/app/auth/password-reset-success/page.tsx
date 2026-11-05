'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { linkStyle } from '@/components/auth/constants';
import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <AuthMessageCard
      icon={EmailVerifiedIconUrl}
      iconAlt="密碼重設成功"
      title="密碼重設成功"
    >
      <p className="text-text-secondary">您現在可以使用新密碼登入。</p>

      <Button
        shape="pill"
        className="min-w-[135px] px-6"
        onClick={() => router.push('/auth/signin')}
      >
        前往登入
      </Button>

      <Link href="/" className={linkStyle}>
        回首頁
      </Link>
    </AuthMessageCard>
  );
}

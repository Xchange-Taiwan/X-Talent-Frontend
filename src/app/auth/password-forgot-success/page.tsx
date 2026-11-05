'use client';

import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { Button } from '@/components/ui/button';
import usePasswordResend from '@/hooks/auth/usePasswordResend';

export default function Page() {
  const { isResending, handleResend, handleChangeEmail } = usePasswordResend();

  return (
    <AuthMessageCard
      icon={EmailVerifyIconUrl}
      iconAlt="郵件已送出"
      title="郵件已送出"
    >
      <p className="text-text-secondary">
        系統將自動寄送郵件給您，請查看您的信箱並點擊連結以重設密碼。
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <Button
          type="button"
          shape="pill"
          className="min-w-[135px] px-6"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? '寄送中...' : '重新寄送'}
        </Button>
        <Button
          type="button"
          shape="pill"
          className="min-w-[135px] px-6"
          variant="outline"
          onClick={handleChangeEmail}
        >
          更換信箱
        </Button>
      </div>
    </AuthMessageCard>
  );
}

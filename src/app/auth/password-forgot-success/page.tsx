'use client';

import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import AuthMessageCard from '@/components/auth/AuthMessageCard';
import { Button } from '@/components/ui/button';
import usePasswordResend from '@/hooks/auth/usePasswordResend';

export default function Page() {
  const { isResending, handleResend, handleChangeEmail } = usePasswordResend();

  return (
    <div className="flex w-full flex-col items-center justify-center py-16">
      <AuthMessageCard
        icon={EmailVerifyIconUrl}
        iconAlt="郵件已送出"
        title="郵件已送出"
        contentClassName="px-10 pt-20 pb-20 text-center"
      >
        <div className="text-neutral-600 flex w-full flex-col items-center gap-1 text-center">
          系統將自動寄送郵件給您，請查看您的信箱並點擊連結以重設密碼。
        </div>

        <div className="flex w-full justify-center gap-4 pt-6">
          <Button
            type="button"
            className="w-[135px] rounded-full"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? '寄送中...' : '重新寄送'}
          </Button>
          <Button
            type="button"
            className="w-[135px] rounded-full"
            variant="outline"
            onClick={handleChangeEmail}
          >
            更換信箱
          </Button>
        </div>
      </AuthMessageCard>
    </div>
  );
}

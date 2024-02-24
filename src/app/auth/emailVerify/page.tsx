'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  const handleResendEmail = () => {
    alert('Resend email');
  };

  return (
    <div className="mx-auto my-40 max-w-[90%] overflow-hidden rounded-2xl border-2 border-solid border-background-border md:max-w-[630px]">
      <div className="relative h-[108px] bg-[#EBFBFB]">
        <Image
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
          src={EmailVerifyIconUrl.src}
          alt="Verify Email"
          width={80}
          height={80}
        />
      </div>
      <div className="flex flex-col items-center gap-6 p-20 text-center">
        <h1 className="text-[32px] font-bold leading-10">驗證信箱</h1>

        <p className="text-neutral-600">
          已傳送一封驗證信，點選連結以完成帳號註冊。
        </p>

        <Button
          className="max-w-60 rounded-full"
          onClick={() => router.push('/')}
        >
          回首頁
        </Button>

        <p className="text-xs text-text-tertiary">
          沒有收到信嗎？{' '}
          <span
            className="cursor-pointer underline decoration-1"
            onClick={handleResendEmail}
          >
            點此重新寄送
          </span>
        </p>
      </div>
    </div>
  );
}

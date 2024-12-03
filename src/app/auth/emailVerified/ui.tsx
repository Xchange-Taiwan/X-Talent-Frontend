import Image from 'next/image';

import EmailVerifiedIconUrl from '@/assets/auth/email-verified-icon.svg';
import { Button } from '@/components/ui/button';

interface EmailVerifiedPresentationProps {
  onSetProfile: () => void;
}

export default function EmailVerifiedPresentation({
  onSetProfile,
}: EmailVerifiedPresentationProps) {
  return (
    <div className="mx-auto my-40 max-w-[90%] overflow-hidden rounded-2xl border-2 border-solid border-background-border md:max-w-[630px]">
      <div className="relative h-[108px] bg-[#EBFBFB]">
        <Image
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3 transform"
          src={EmailVerifiedIconUrl.src}
          alt="Verify Email"
          width={80}
          height={80}
        />
      </div>
      <div className="flex flex-col items-center gap-6 p-20 text-center">
        <h1 className="text-[32px] font-bold leading-10">驗證成功</h1>

        <p className="text-neutral-600">
          你的帳號已完成註冊。現在可以開始建立你的個人頁面和尋找 Mentors 了！
        </p>

        <Button className="max-w-60 rounded-full" onClick={onSetProfile}>
          設定個人資訊
        </Button>
      </div>
    </div>
  );
}

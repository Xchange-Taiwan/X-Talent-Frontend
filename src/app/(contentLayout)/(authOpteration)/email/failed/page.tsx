'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { WarnSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';

export enum EmailConfirmEnum {
  VALIDATE_EMAIL = 'VALIDATE_EMAIL',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

const EMAIL_CONFIRM_MAP = {
  [EmailConfirmEnum.VALIDATE_EMAIL]: {
    title: '驗證連結已失效',
    subTitle: (
      <>
        您所使用的驗證連結已失效
        <br />
        請點擊下方按鈕，我們將重新發送驗證信。
      </>
    ),
  },
  [EmailConfirmEnum.RESET_PASSWORD]: {
    title: '重設連結已失效',
    subTitle: (
      <>
        您所使用的密碼重設連結已失效
        <br />
        請點擊下方按鈕，我們將發送新的連結至您的信箱。
      </>
    ),
  },
};

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get('type') || '';

  if (!Object.keys(EMAIL_CONFIRM_MAP).includes(type)) {
    router.push('/');
    return;
  }

  const { title, subTitle } =
    EMAIL_CONFIRM_MAP[type as keyof typeof EMAIL_CONFIRM_MAP];

  const handleResendEmail = () => {
    console.log('Resend Email');
  };

  return (
    <div className="mx-auto flex h-screen max-w-[400px] flex-col gap-6 px-5 py-10 sm:px-0 sm:py-[120px]">
      <main className="flex flex-auto flex-col justify-center gap-6 sm:flex-none ">
        <div className="mb-6 flex flex-col items-center gap-6">
          <div className="rounded-full bg-[#EB5757]/[0.1] p-4">
            <WarnSolid className="text-2xl text-[#EB5757]" />
          </div>
          <h1 className="text-[32px] font-bold leading-10">{title}</h1>
          <p className="text-center text-neutral-600">{subTitle}</p>
        </div>
      </main>
      <footer className="flex flex-col gap-4">
        <Button className="rounded-full" onClick={handleResendEmail}>
          重新發送
        </Button>

        <Link href="/" className="text-center underline underline-offset-2">
          回首頁
        </Link>
      </footer>
    </div>
  );
}

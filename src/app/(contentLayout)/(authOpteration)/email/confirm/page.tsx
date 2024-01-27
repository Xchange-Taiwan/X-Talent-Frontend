'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { EmailSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';

enum EmailConfirmEnum {
  VALIDATE_EMAIL = 'VALIDATE_EMAIL',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

const EMAIL_CONFIRM_MAP = {
  [EmailConfirmEnum.VALIDATE_EMAIL]: {
    title: '驗證您的信箱',
    subTitle: (
      <>
        驗證信至您的信箱
        <br />
        請在1小時內，依信件指示完成帳號開通
      </>
    ),
  },
  [EmailConfirmEnum.RESET_PASSWORD]: {
    title: '已寄出重設密碼信件',
    subTitle: (
      <>
        已寄出「重設密碼通知」信件至您的信箱
        <br />
        請依信件指示完成密碼重設
      </>
    ),
  },
};

function PageTitle() {
  const router = useRouter();

  const searchParams = useSearchParams();
  const type = searchParams.get('type') || '';

  if (!Object.keys(EMAIL_CONFIRM_MAP).includes(type)) {
    router.push('/');
    return;
  }

  const { title, subTitle } =
    EMAIL_CONFIRM_MAP[type as keyof typeof EMAIL_CONFIRM_MAP];

  return (
    <>
      <h1 className="text-[32px] font-bold leading-10">{title}</h1>
      <p className="text-neutral-600 text-center">{subTitle}</p>
    </>
  );
}

export default function Page() {
  const router = useRouter();

  const handleResendEmail = () => {
    console.log('Resend Email');
  };

  return (
    <div className="mx-auto flex h-screen max-w-[400px] flex-col gap-6 px-5 py-10 sm:px-0 sm:py-[120px]">
      <main className="flex flex-auto flex-col justify-center gap-6 sm:flex-none ">
        <div className="mb-6 flex flex-col items-center gap-6">
          <div className="rounded-full bg-[#EBFBFB] p-4">
            <EmailSolid className="text-2xl" />
          </div>
          <Suspense>
            <PageTitle />
          </Suspense>
        </div>
      </main>

      <footer className="flex flex-col gap-4">
        <Button className="rounded-full" onClick={() => router.push('/')}>
          回首頁
        </Button>

        <p className="text-neutral-600 text-center">
          沒有收到驗證信?
          <Button
            variant="link"
            className="text-black font-medium underline"
            onClick={handleResendEmail}
          >
            重新發送
          </Button>
        </p>
      </footer>
    </div>
  );
}

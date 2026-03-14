'use client';

import Image from 'next/image';

import EmailVerifyIconUrl from '@/assets/auth/email-verify-icon.svg';
import { Button } from '@/components/ui/button';
import usePasswordResend from '@/hooks/auth/usePasswordResend';

export default function Page() {
  const { isResending, handleResend, handleChangeEmail } = usePasswordResend();

  return (
    <div className="flex w-full flex-col items-center justify-center py-16">
      <div className="relative mx-auto flex w-[342px] flex-col items-center overflow-hidden rounded-2xl border border-[#E6E8EA] bg-[#EBFBFB] pt-20 lg:w-[629px]">
        <Image
          className="absolute left-[50%] top-10 -translate-x-[50%] transform"
          src={EmailVerifyIconUrl}
          alt="Verify Email"
          width={80}
          height={80}
        />
        <main className="flex w-full flex-auto flex-col justify-center gap-6 bg-background-white px-10 pt-20 sm:flex-none ">
          <div className="flex justify-center">
            <h1 className="text-[32px] font-bold leading-10">Email Sent</h1>
          </div>
          <div className="flex w-full flex-col items-start gap-1 text-center">
            The system will automatically send you an email. Please check your
            mailbox and click the link to reset the password.
          </div>
        </main>

        <footer className="flex w-full justify-center gap-4 bg-background-white pb-20 pt-6">
          <Button
            type="button"
            className="w-[135px] rounded-full"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? 'Resending...' : 'Resend Email'}
          </Button>
          <Button
            type="button"
            className="w-[135px] rounded-full"
            variant="outline"
            onClick={handleChangeEmail}
          >
            Change Email
          </Button>
        </footer>
      </div>
    </div>
  );
}

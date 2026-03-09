'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="bg-white">
      <main className="px-6 pb-20 pt-16">
        <div className="bg-white mx-auto w-full max-w-[554px] overflow-hidden rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="h-[88px] bg-[linear-gradient(90deg,#EAFBFB_0%,#CFEFFF_45%,#EAE4FF_100%)]" />

          <div className="px-8 pb-10">
            <h1 className="relative -mt-5 text-center text-[32px] font-bold leading-[1.2] text-[#1E1E1E]">
              密碼重設成功
            </h1>

            <p className="mt-4 text-center text-base leading-6 text-[#52525B]">
              您現在可以使用新密碼登入。
            </p>

            <div className="mt-8 flex justify-center">
              <Button
                className="text-white h-[36px] min-w-[92px] rounded-full bg-[#35C9CF] px-6 text-sm font-semibold hover:bg-[#2fbec4]"
                onClick={() => router.push('/auth/signin')}
              >
                前往登入
              </Button>
            </div>

            <div className="mt-5 text-center">
              <Link
                href="/"
                className="text-sm text-[#1E1E1E] underline underline-offset-2"
              >
                回首頁
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

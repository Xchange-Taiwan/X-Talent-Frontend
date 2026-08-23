'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="bg-background-white">
      <main className="px-6 pt-16 pb-20">
        <div className="border-background-border bg-background-white shadow-card mx-auto w-full max-w-[554px] overflow-hidden rounded-2xl border">
          <div className="bg-auth-card h-[88px]" />

          <div className="px-8 pb-10">
            <h1 className="text-32 text-text-primary relative -mt-5 text-center leading-[1.2] font-bold">
              密碼重設成功
            </h1>

            <p className="text-text-secondary mt-4 text-center text-base leading-6">
              您現在可以使用新密碼登入。
            </p>

            <div className="mt-8 flex justify-center">
              <Button
                size="sm"
                shape="pill"
                className="min-w-[92px] px-6"
                onClick={() => router.push('/auth/signin')}
              >
                前往登入
              </Button>
            </div>

            <div className="mt-5 text-center">
              <Link
                href="/"
                className="text-text-primary text-sm underline underline-offset-2"
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

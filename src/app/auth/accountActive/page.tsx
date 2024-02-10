'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { VectorSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="mx-auto flex h-screen max-w-[400px] flex-col gap-6 px-5 py-10 sm:px-0 sm:py-[120px]">
      <main className="flex flex-auto flex-col justify-center gap-6 sm:flex-none ">
        <div className="mb-6 flex flex-col items-center gap-6">
          <div className="rounded-full bg-[#EBFBFB] p-4">
            <VectorSolid className="text-2xl" />
          </div>
          <h1 className="text-[32px] font-bold leading-10">帳號啟用成功</h1>
          <p className="text-neutral-600 text-center">
            恭喜您已完成帳號開通！
            <br />
            在開始這趟交流之旅前，讓我們更了解你的需求...
          </p>
        </div>
      </main>
      <footer className="flex flex-col gap-4">
        <Button
          className="rounded-full"
          onClick={() => router.push('/auth/signin')}
        >
          前往會員登入
        </Button>

        <Link href="/" className="text-center underline underline-offset-2">
          回首頁
        </Link>
      </footer>
    </div>
  );
}

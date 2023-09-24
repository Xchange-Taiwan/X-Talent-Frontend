'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { VectorSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div className="mb-6 flex flex-col items-center gap-6">
        <div className="rounded-full bg-[#EBFBFB] p-4">
          <VectorSolid className="text-2xl" />
        </div>
        <h1 className="text-[32px] font-bold leading-10">密碼更改成功</h1>
        <p className="text-center text-neutral-600">
          您的密碼已成功更改，請使用新的密碼進行登入。
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Button className="rounded-full" onClick={() => router.push('/signin')}>
          前往會員登入
        </Button>

        <Link href="/" className="text-center underline underline-offset-2">
          回首頁
        </Link>
      </div>
    </div>
  );
}

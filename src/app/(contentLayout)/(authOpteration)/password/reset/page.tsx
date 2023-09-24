import Link from 'next/link';

import { LockSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Page() {
  return (
    <div className="mx-auto flex h-screen max-w-[400px] flex-col gap-6 px-5 py-10 sm:px-0 sm:py-[120px]">
      <main className="flex flex-auto flex-col justify-center gap-6 sm:flex-none ">
        <div className="mb-6 flex flex-col items-center gap-6">
          <div className="rounded-full bg-[#EBFBFB] p-4">
            <LockSolid className="text-2xl" />
          </div>
          <h1 className="text-[32px] font-bold leading-10">重設密碼</h1>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="password">新密碼</Label>
            <Input id="password" type="password" placeholder="請輸入新密碼" />
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="password-confirm">確認新密碼</Label>
            <Input
              id="password-confirm"
              type="password"
              placeholder="請再次輸入新密碼"
            />
          </div>
        </div>
      </main>

      <footer className="flex flex-col gap-4">
        <Button className="rounded-full">更改密碼</Button>

        <Link
          href="/auth/signin"
          className="text-center underline underline-offset-2"
        >
          返回登入頁
        </Link>
      </footer>
    </div>
  );
}

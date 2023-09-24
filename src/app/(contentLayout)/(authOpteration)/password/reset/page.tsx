import Link from 'next/link';

import { LockSolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[400px]">
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

        <Button className="rounded-full">更改密碼</Button>

        <Link
          href="/signin"
          className="text-center underline underline-offset-2"
        >
          返回登入頁
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';

import { KeySolid } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[400px]">
      <div className="mb-6 flex flex-col items-center gap-6">
        <div className="rounded-full bg-[#EBFBFB] p-4">
          <KeySolid className="text-2xl" />
        </div>
        <h1 className="text-[32px] font-bold leading-10">忘記密碼</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="email">電子郵件地址</Label>
          <Input id="email" type="email" placeholder="請填入您的E-mail" />
        </div>

        <Button className="rounded-full">送出</Button>

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

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Page() {
  return (
    <div className="bg-white">
      <main className="px-6 py-16">
        <div className="bg-white mx-auto w-full max-w-[556px] rounded-[16px] border border-[#E5E7EB] px-9 py-14 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="mx-auto w-full max-w-[484px]">
            <h1 className="mb-8 text-center text-[32px] font-bold leading-[1.2] text-[#1E1E1E]">
              重設密碼
            </h1>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-base font-normal text-[#2B2B2B]"
                >
                  新密碼
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="請輸入新密碼"
                  className="h-[36px] rounded-[8px] border border-[#D9D9D9] px-3 text-sm placeholder:text-[#B3B3B3]"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password-confirm"
                  className="text-base font-normal text-[#2B2B2B]"
                >
                  確認新密碼
                </Label>
                <Input
                  id="password-confirm"
                  type="password"
                  placeholder="請再次輸入新密碼"
                  className="h-[36px] rounded-[8px] border border-[#D9D9D9] px-3 text-sm placeholder:text-[#B3B3B3]"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Button className="text-white h-[36px] min-w-[92px] rounded-full bg-[#35C9CF] px-6 text-sm font-semibold hover:bg-[#2fbec4]">
                更改密碼
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/auth/signin"
                className="text-sm text-[#1E1E1E] underline underline-offset-2"
              >
                返回登入頁
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

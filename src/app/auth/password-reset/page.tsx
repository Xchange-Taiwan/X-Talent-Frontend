'use client';

import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePasswordResetForm from '@/hooks/auth/usePasswordResetForm';

function PasswordResetForm() {
  const { form, isSubmitting, onSubmit } = usePasswordResetForm();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
            {...register('password')}
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="confirm_password"
            className="text-base font-normal text-[#2B2B2B]"
          >
            確認新密碼
          </Label>
          <Input
            id="confirm_password"
            type="password"
            placeholder="請再次輸入新密碼"
            className="h-[36px] rounded-[8px] border border-[#D9D9D9] px-3 text-sm placeholder:text-[#B3B3B3]"
            {...register('confirm_password')}
          />
          {errors.confirm_password && (
            <p className="text-red-500 text-sm">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="text-white h-[36px] min-w-[92px] rounded-full bg-[#35C9CF] px-6 text-sm font-semibold hover:bg-[#2fbec4] disabled:opacity-50"
        >
          {isSubmitting ? '處理中...' : '更改密碼'}
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <div className="bg-white">
      <main className="px-6 py-16">
        <div className="bg-white mx-auto w-full max-w-[556px] rounded-[16px] border border-[#E5E7EB] px-9 py-14 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="mx-auto w-full max-w-[484px]">
            <h1 className="mb-8 text-center text-[32px] font-bold leading-[1.2] text-[#1E1E1E]">
              重設密碼
            </h1>

            <Suspense>
              <PasswordResetForm />
            </Suspense>

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

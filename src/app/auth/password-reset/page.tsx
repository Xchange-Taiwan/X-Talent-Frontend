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
            className="text-text-primary text-base font-normal"
          >
            新密碼
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="請輸入新密碼"
            className="border-background-border placeholder:text-text-disable h-[36px] rounded-[8px] border px-3 text-sm"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-status-error-default text-sm">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="confirm_password"
            className="text-text-primary text-base font-normal"
          >
            確認新密碼
          </Label>
          <Input
            id="confirm_password"
            type="password"
            placeholder="請再次輸入新密碼"
            className="border-background-border placeholder:text-text-disable h-[36px] rounded-[8px] border px-3 text-sm"
            {...register('confirm_password')}
          />
          {errors.confirm_password && (
            <p className="text-status-error-default text-sm">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          type="submit"
          size="sm"
          shape="pill"
          disabled={isSubmitting}
          className="min-w-[92px] px-6"
        >
          {isSubmitting ? '處理中...' : '更改密碼'}
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <div className="bg-background-white">
      <main className="px-6 py-16">
        <div className="border-background-border bg-background-white shadow-card mx-auto w-full max-w-[556px] rounded-2xl border px-9 py-14">
          <div className="mx-auto w-full max-w-[484px]">
            <h1 className="text-32 text-text-primary mb-8 text-center leading-[1.2] font-bold">
              重設密碼
            </h1>

            <Suspense>
              <PasswordResetForm />
            </Suspense>

            <div className="mt-6 text-center">
              <Link
                href="/auth/signin"
                className="text-text-primary text-sm underline underline-offset-2"
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

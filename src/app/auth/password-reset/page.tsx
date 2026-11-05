'use client';

import Link from 'next/link';
import { Suspense } from 'react';

import AuthCard from '@/components/auth/AuthCard';
import { linkStyle } from '@/components/auth/constants';
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-6"
      noValidate
    >
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
            {...register('confirm_password')}
          />
          {errors.confirm_password && (
            <p className="text-status-error-default text-sm">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-center">
        <Button
          type="submit"
          shape="pill"
          disabled={isSubmitting}
          className="min-w-[135px] px-6"
        >
          {isSubmitting ? '處理中...' : '更改密碼'}
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <AuthCard>
      <div className="mx-auto flex w-full max-w-[484px] flex-col items-center gap-6">
        <h1 className="text-32 text-text-primary text-center leading-10 font-bold">
          重設密碼
        </h1>

        <Suspense>
          <PasswordResetForm />
        </Suspense>

        <Link href="/auth/signin" className={linkStyle}>
          返回登入頁
        </Link>
      </div>
    </AuthCard>
  );
}

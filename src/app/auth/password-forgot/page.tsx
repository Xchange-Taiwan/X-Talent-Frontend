'use client';

import AuthCard from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePasswordForgotForm from '@/hooks/auth/usePasswordForgotForm';

export default function Page() {
  const { form, isSubmitting, onSubmit } = usePasswordForgotForm();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex w-full max-w-[484px] flex-col items-center gap-6"
        noValidate
      >
        <h1 className="text-32 text-text-primary text-center leading-10 font-bold">
          忘記密碼
        </h1>

        <div className="grid w-full items-center gap-2">
          <Label
            htmlFor="email"
            className="text-text-primary text-base font-normal"
          >
            電子郵件地址
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="請填入您的E-mail"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-status-error-default text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-center">
          <Button
            type="submit"
            shape="pill"
            className="min-w-[135px] px-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? '處理中...' : '送出'}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

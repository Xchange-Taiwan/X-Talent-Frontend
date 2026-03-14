'use client';

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
    <div className="flex w-full flex-col items-center justify-center py-16">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex w-[342px] flex-col items-center gap-6 rounded-2xl border border-[#E6E8EA] px-10 py-20 lg:w-[629px]"
        noValidate
      >
        <main className="flex w-full flex-auto flex-col justify-center gap-6 sm:flex-none ">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-[32px] font-bold leading-10">忘記密碼</h1>
          </div>

          <div className="flex w-full flex-col items-start gap-1">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="email">電子郵件地址</Label>
              <Input
                id="email"
                type="email"
                placeholder="請填入您的E-mail"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-status-200">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </main>

        <footer className="flex w-[94px] flex-col gap-4">
          <Button
            type="submit"
            className="rounded-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? '處理中...' : '送出'}
          </Button>
        </footer>
      </form>
    </div>
  );
}

'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import LogoImgUrl from '@/assets/logo.svg';
import { Google } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  email: z.string().email('請輸入電子郵件'),
  password: z.string().min(8, { message: '密碼至少需為 8 個字' }),
  hasReadTermsOfService: z.boolean().refine((hasRead) => hasRead, {
    message: '請確認並同意服務條款',
  }),
});

const linkStyle = 'text-sm font-medium text-black underline underline-offset-2';

export default function Page() {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      hasReadTermsOfService: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);

    // TODO: Demo 使用 待移除
    router.push('/auth/profile');
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="mb-10">
        <Image src={LogoImgUrl} width={180} height={64} alt="Logo" />
      </div>
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <h1 className="text-center text-[32px] font-bold leading-tight">
          註冊帳號
        </h1>

        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel showErrorStyle={false}>電子郵件地址</FormLabel>
                  <FormControl>
                    <Input placeholder="請填入您的 E-mail" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel showErrorStyle={false}>登入密碼</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="請輸入密碼"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hasReadTermsOfService"
              render={({ field }) => (
                <>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-medium leading-none text-neutral-600">
                      我同意{' '}
                      <Link className={linkStyle} href="/password/forget">
                        X-Talent服務條款
                      </Link>
                    </FormLabel>
                  </FormItem>
                  <FormMessage />
                </>
              )}
            />

            <Button className="h-12 w-full rounded-full" type="submit">
              註冊
            </Button>
          </form>
        </Form>

        <div className="flex flex-col gap-4">
          <p className="text-neutral-600">
            已經有帳號了?{' '}
            <Link href="/auth/signin" className={linkStyle}>
              登入X-Talent
            </Link>
          </p>
        </div>

        <div className="flex items-center px-6">
          <div className="h-[1px] flex-1 bg-neutral-200" />
          <p className="flex-0 px-2 text-neutral-600">或</p>
          <div className="h-[1px] flex-1 bg-neutral-200" />
        </div>

        <div>
          <Button variant="outline" className="h-12 w-full rounded-full">
            <Google className="mr-3 text-xl" />
            <span className="text-base">使用 Google 繼續</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { Form, Formik } from 'formik';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

import Button from './components/Button';
import CheckBoxField from './components/CheckBoxField';
import DivideLine from './components/DivideLine';
import TextField from './components/TextField';

const LogInPage = () => {
  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-6 text-2xl font-bold leading-9 tracking-tight text-gray-900">
          登入
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <Formik
          initialValues={{
            account: '',
            password: '',
            toggle: false,
          }}
          onSubmit={async (params, { setSubmitting }) => {
            await signIn('credentials', {
              callbackUrl: '/Dashboard',
              ...params,
            });
            setSubmitting(false);
          }}
        >
          <Form>
            <TextField
              id="account"
              type="text"
              fieldName="account"
              labelText="電子郵件地址"
              placeholder="請填入您的E-mail"
            />
            <TextField
              id="password"
              type="password"
              fieldName="password"
              labelText="密碼"
              placeholder="請輸入密碼"
            />
            <CheckBoxField
              fieldName="toggle"
              labelText="記住我"
              id="rememberMe"
            />
            <div className="py-4">
              <Button type="submit">登入</Button>

              <p className="pt-6 text-center text-slate-500">
                還不是會員嗎 ?{' '}
                <Link
                  href="/register"
                  className="font-bold text-slate-800 underline underline-offset-4 hover:text-slate-700"
                >
                  註冊
                </Link>
              </p>
            </div>
          </Form>
        </Formik>

        <DivideLine />

        <div className="mt-6 flex flex-col gap-6">
          <Button color="secondary">使用 Google 繼續</Button>
          <Button color="secondary">使用 LinkedIn 繼續</Button>
        </div>
      </div>
    </div>
  );
};

export default LogInPage;

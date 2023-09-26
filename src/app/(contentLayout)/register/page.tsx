'use client';
import { Form, Formik } from 'formik';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

import Button from '../login/components/Button';
import CheckBoxField from '../login/components/CheckBoxField';
import DivideLine from '../login/components/DivideLine';
import TextField from '../login/components/TextField';

const LogInPage = () => {
  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-gray-900 mt-6 text-2xl font-bold leading-9 tracking-tight">
          註冊
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
              id="rememberMe"
              fieldName="toggle"
              labelText={
                <>
                  我了解並同意{' '}
                  <span className="cursor-pointer  font-bold underline underline-offset-4">
                    X-talent 服務條款
                  </span>
                </>
              }
            />
            <div className="py-4">
              <Button>註冊</Button>

              <p className="text-slate-500 pt-6 text-center">
                已經有帳號了 ?{' '}
                <Link
                  href="/login"
                  className="text-slate-800 hover:text-slate-700 font-bold underline underline-offset-4"
                >
                  登入
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

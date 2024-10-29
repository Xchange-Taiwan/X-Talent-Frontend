'use client';
import React from 'react';

import AuthTitle from '@/components/auth/AuthTitle';
import Divider from '@/components/auth/Divider';
import GoogleSignUpButton from '@/components/auth/GoogleButton';

import SignInLink from '../../../../components/auth/signup/SignInLink';
import SignUpForm from '../../../../components/auth/signup/SignUpForm';
import useSignUpForm from '../../../../hooks/auth/useSignUpForm';

export default function SignUpPage() {
  const { form, isSubmitting, onSubmit } = useSignUpForm();

  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <AuthTitle>註冊 Talents 帳戶</AuthTitle>
        <SignUpForm
          form={form}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
        <SignInLink />
        <Divider>或</Divider>
        <GoogleSignUpButton isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}

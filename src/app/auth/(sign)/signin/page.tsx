'use client';

import AuthTitle from '@/components/auth/AuthTitle';
import Divider from '@/components/auth/Divider';
import GoogleSignUpButton from '@/components/auth/GoogleButton';
import SignInForm from '@/components/auth/signin/SignInForm';
import useSignInForm from '@/hooks/auth/useSignInForm';

export default function AuthPage() {
  const signInFormProps = useSignInForm();

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 pb-8 sm:pb-0">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <AuthTitle>登入 X-Talent 帳戶</AuthTitle>
        <SignInForm {...signInFormProps} />
        <Divider>或</Divider>
        <GoogleSignUpButton
          isSubmitting={signInFormProps.isSubmitting}
          label="使用 Google 帳號登入"
          isSignIn={true}
        />
      </div>
    </div>
  );
}

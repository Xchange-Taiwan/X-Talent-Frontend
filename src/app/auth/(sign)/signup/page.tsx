'use client';
import AuthTitle from '@/components/auth/AuthTitle';
import Divider from '@/components/auth/Divider';
import GoogleSignUpButton from '@/components/auth/GoogleButton';
import SignUpForm from '@/components/auth/signup/SignUpForm';
import useSignUpForm from '@/hooks/auth/useSignUpForm';

export default function AuthPage() {
  const signUpFormProps = useSignUpForm();

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 pb-8 sm:pb-0">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <AuthTitle>註冊 X-Talent 帳戶</AuthTitle>
        <SignUpForm {...signUpFormProps} />
        <Divider>或</Divider>
        <GoogleSignUpButton
          isSubmitting={signUpFormProps.isSubmitting}
          label="使用 Google 帳號註冊"
          isSignIn={false}
        />
      </div>
    </div>
  );
}

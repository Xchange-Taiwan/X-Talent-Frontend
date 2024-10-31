import AuthTitle from '@/components/auth/AuthTitle';
import Divider from '@/components/auth/Divider';
import GoogleSignUpButton from '@/components/auth/GoogleButton';
import SignInForm from '@/components/auth/signin/SignInForm';
import SignUpForm from '@/components/auth/signup/SignUpForm';
import { AuthPageType } from '@/components/auth/types';
import useSignInForm from '@/hooks/auth/useSignInForm';
import useSignUpForm from '@/hooks/auth/useSignUpForm';

interface AuthPageProps {
  type: AuthPageType;
}

export default function AuthPage({ type }: AuthPageProps) {
  const signUpFormProps = useSignUpForm();
  const signInFormProps = useSignInForm();

  const isSignUp = type === 'signup';
  const formProps = isSignUp ? signUpFormProps : signInFormProps;

  const FormComponent = () => {
    return isSignUp ? (
      <SignUpForm {...signUpFormProps} />
    ) : (
      <SignInForm {...signInFormProps} />
    );
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 pb-8 sm:pb-0">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <AuthTitle>{isSignUp ? '註冊' : '登入'} Talents 帳戶</AuthTitle>
        <FormComponent />
        <Divider>或</Divider>
        <GoogleSignUpButton isSubmitting={formProps.isSubmitting} />
      </div>
    </div>
  );
}

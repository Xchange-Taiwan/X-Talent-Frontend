import { z } from 'zod';

import AuthButton from '@/components/auth/AuthButton';
import AuthFormInput from '@/components/auth/AuthFormInput';
import SignUpLink from '@/components/auth/AuthLink';
import { formFieldData } from '@/components/auth/signin/constants';
import ForgotPasswordLink from '@/components/auth/signin/ForgotPasswordLink';
import { AuthFormFieldType, AuthFormProps } from '@/components/auth/types';
import { Form } from '@/components/ui/form';
import { SignInSchema } from '@/schemas/auth';

type SignInValues = z.infer<typeof SignInSchema>;

export default function SignInForm({
  form,
  isSubmitting,
  onSubmit,
}: AuthFormProps<SignInValues>) {
  return (
    <div className="flex flex-col gap-4">
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          {formFieldData.map((field: AuthFormFieldType<'signin'>) => (
            <AuthFormInput
              key={field.name}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              type={field.type}
              control={form.control}
              autocomplete={field.autocomplete}
              forgotPasswordLink={
                field.name === 'password' ? <ForgotPasswordLink /> : undefined
              }
            />
          ))}
          <AuthButton isSubmitting={isSubmitting}>登入</AuthButton>
          <SignUpLink
            prefixText="還不是會員?"
            text="註冊X-Talent"
            href="/auth/signup"
          />
        </form>
      </Form>
    </div>
  );
}

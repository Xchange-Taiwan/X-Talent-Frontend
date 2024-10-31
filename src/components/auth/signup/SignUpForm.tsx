import { z } from 'zod';

import AuthButton from '@/components/auth/AuthButton';
import AuthFormInput from '@/components/auth/AuthFormInput';
import SignInLink from '@/components/auth/AuthLink';
import { AuthFormFieldType } from '@/components/auth/types';
import { AuthFormProps } from '@/components/auth/types';
import { Form } from '@/components/ui/form';
import { SignUpSchema } from '@/schemas/auth';

import { formFieldData } from './constants';
import TermsOfServiceCheckbox from './TermsOfServiceCheckbox';
type SignUpValues = z.infer<typeof SignUpSchema>;

export default function SignUpForm({
  form,
  isSubmitting,
  onSubmit,
}: AuthFormProps<SignUpValues>) {
  return (
    <div className="flex flex-col gap-4">
      <Form {...form}>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          {formFieldData.map((field: AuthFormFieldType<'signup'>) => (
            <AuthFormInput
              key={field.name}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              type={field.type}
              control={form.control}
            />
          ))}
          <TermsOfServiceCheckbox control={form.control} />
          <AuthButton isSubmitting={isSubmitting}>註冊</AuthButton>
          <SignInLink
            prefixText="已經有帳號了?"
            text="登入X-Talent"
            href="/auth/signin"
          />
        </form>
      </Form>
    </div>
  );
}

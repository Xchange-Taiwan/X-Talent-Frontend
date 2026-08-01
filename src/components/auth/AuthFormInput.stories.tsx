import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form } from '@/components/ui/form';

import AuthFormInput from './AuthFormInput';

const meta: Meta<typeof AuthFormInput> = {
  title: '業務模組元件/會員驗證(Auth)/AuthFormInput',
  component: AuthFormInput,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AuthFormInput>;

interface FormValues {
  email: string;
  password?: string;
  verificationCode?: string;
}

interface WrapperProps {
  name: keyof FormValues;
  label: string;
  placeholder: string;
  type?: string;
  autocomplete?: string;
  triggerError?: boolean;
  forgotPasswordLink?: React.ReactNode;
}

const FormInputWrapper = ({
  name,
  label,
  placeholder,
  type = 'text',
  autocomplete = 'off',
  triggerError = false,
  forgotPasswordLink,
}: WrapperProps) => {
  const form = useForm<FormValues>({
    defaultValues: {
      email: '',
      password: '',
      verificationCode: '',
    },
  });

  React.useEffect(() => {
    if (triggerError) {
      form.setError(name, {
        type: 'manual',
        message: '輸入格式不正確，請確認後再試一次',
      });
    } else {
      form.clearErrors(name);
    }
  }, [form, name, triggerError]);

  return (
    <Form {...form}>
      <form
        className="max-w-md space-y-4 p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <AuthFormInput
          name={name}
          label={label}
          placeholder={placeholder}
          type={type}
          control={form.control}
          autocomplete={autocomplete}
          forgotPasswordLink={forgotPasswordLink}
        />
      </form>
    </Form>
  );
};

export const Normal: Story = {
  render: () => (
    <FormInputWrapper
      name="email"
      label="電子信箱"
      placeholder="例如：talent@xchange.tw"
      type="text"
      autocomplete="email"
    />
  ),
};

export const Password: Story = {
  render: () => (
    <FormInputWrapper
      name="password"
      label="密碼"
      placeholder="請輸入密碼"
      type="password"
      autocomplete="current-password"
      forgotPasswordLink={
        <div className="text-right text-xs">
          <a href="#" className="text-text-tertiary hover:underline">
            忘記密碼？
          </a>
        </div>
      }
    />
  ),
};

export const ValidationError: Story = {
  render: () => (
    <FormInputWrapper
      name="verificationCode"
      label="驗證碼"
      placeholder="請輸入 6 位數驗證碼"
      type="text"
      autocomplete="one-time-code"
      triggerError={true}
    />
  ),
};

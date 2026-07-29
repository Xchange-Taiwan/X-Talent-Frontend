import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { SignUpSchema } from '@/schemas/auth';

import SignUpForm from './SignUpForm';

const meta: Meta<typeof SignUpForm> = {
  title: 'Components/Auth/SignUpForm',
  component: SignUpForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SignUpForm>;

interface SignUpFormWrapperProps {
  defaultValues?: z.infer<typeof SignUpSchema>;
  isSubmitting?: boolean;
  triggerValidation?: boolean;
}

const SignUpFormWrapper = ({
  defaultValues = {
    email: '',
    password: '',
    confirm_password: '',
    hasReadTermsOfService: false,
  },
  isSubmitting = false,
  triggerValidation = false,
}: SignUpFormWrapperProps) => {
  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (triggerValidation) {
      form.trigger();
    }
  }, [form, triggerValidation]);

  return (
    <SignUpForm
      form={form}
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        alert(`Form submitted: ${JSON.stringify(values)}`);
      }}
    />
  );
};

export const Default: Story = {
  render: () => <SignUpFormWrapper />,
};

export const Filled: Story = {
  render: () => (
    <SignUpFormWrapper
      defaultValues={{
        email: 'talent@xchange.tw',
        password: 'password123',
        confirm_password: 'password123',
        hasReadTermsOfService: true,
      }}
    />
  ),
};

export const ValidationError: Story = {
  render: () => (
    <SignUpFormWrapper
      defaultValues={{
        email: 'invalid-email',
        password: '123',
        confirm_password: '123',
        hasReadTermsOfService: false,
      }}
      triggerValidation={true}
    />
  ),
};

export const PasswordMismatch: Story = {
  render: () => (
    <SignUpFormWrapper
      defaultValues={{
        email: 'talent@xchange.tw',
        password: 'password123',
        confirm_password: 'differentpassword',
        hasReadTermsOfService: true,
      }}
      triggerValidation={true}
    />
  ),
};

export const Submitting: Story = {
  render: () => (
    <SignUpFormWrapper
      defaultValues={{
        email: 'talent@xchange.tw',
        password: 'password123',
        confirm_password: 'password123',
        hasReadTermsOfService: true,
      }}
      isSubmitting={true}
    />
  ),
};

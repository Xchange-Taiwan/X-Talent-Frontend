import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { SignInSchema } from '@/schemas/auth';

import SignInForm from './SignInForm';

const meta: Meta<typeof SignInForm> = {
  title: 'Components/Auth/SignInForm',
  component: SignInForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SignInForm>;

interface SignInFormWrapperProps {
  defaultValues?: z.infer<typeof SignInSchema>;
  isSubmitting?: boolean;
  triggerValidation?: boolean;
}

const SignInFormWrapper = ({
  defaultValues = { email: '', password: '' },
  isSubmitting = false,
  triggerValidation = false,
}: SignInFormWrapperProps) => {
  const form = useForm<z.infer<typeof SignInSchema>>({
    resolver: zodResolver(SignInSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (triggerValidation) {
      form.trigger();
    }
  }, [form, triggerValidation]);

  return (
    <SignInForm
      form={form}
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        alert(`Form submitted: ${JSON.stringify(values)}`);
      }}
    />
  );
};

export const Default: Story = {
  render: () => <SignInFormWrapper />,
};

export const Filled: Story = {
  render: () => (
    <SignInFormWrapper
      defaultValues={{
        email: 'talent@xchange.tw',
        password: 'password123',
      }}
    />
  ),
};

export const ValidationError: Story = {
  render: () => (
    <SignInFormWrapper
      defaultValues={{
        email: 'invalid-email',
        password: '123',
      }}
      triggerValidation={true}
    />
  ),
};

export const Submitting: Story = {
  render: () => (
    <SignInFormWrapper
      defaultValues={{
        email: 'talent@xchange.tw',
        password: 'password123',
      }}
      isSubmitting={true}
    />
  ),
};

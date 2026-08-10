import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form, FormField, FormItem } from '@/components/ui/form';

import ForgotPasswordLink from './ForgotPasswordLink';

const meta: Meta<typeof ForgotPasswordLink> = {
  title: '業務模組元件/會員驗證(Auth)/ForgotPasswordLink',
  component: ForgotPasswordLink,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ForgotPasswordLink>;

const StoryWrapper = () => {
  const form = useForm({
    defaultValues: {
      password: '',
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="password"
        render={() => (
          <FormItem>
            <ForgotPasswordLink />
          </FormItem>
        )}
      />
    </Form>
  );
};

export const Default: Story = {
  render: () => <StoryWrapper />,
};

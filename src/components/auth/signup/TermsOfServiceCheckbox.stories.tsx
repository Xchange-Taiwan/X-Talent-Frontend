import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import { SignUpSchema } from '@/schemas/auth';

import TermsOfServiceCheckbox from './TermsOfServiceCheckbox';

const meta: Meta<typeof TermsOfServiceCheckbox> = {
  title: '業務模組元件/會員驗證(Auth)/TermsOfServiceCheckbox',
  component: TermsOfServiceCheckbox,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TermsOfServiceCheckbox>;

interface CheckboxWrapperProps {
  defaultChecked?: boolean;
  triggerError?: boolean;
}

const CheckboxWrapper = ({
  defaultChecked = false,
  triggerError = false,
}: CheckboxWrapperProps) => {
  const form = useForm({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: 'talent@xchange.tw',
      password: 'password123',
      confirm_password: 'password123',
      hasReadTermsOfService: defaultChecked,
    },
  });

  React.useEffect(() => {
    if (triggerError) {
      form.setError('hasReadTermsOfService', {
        type: 'manual',
        message: '請確認並同意服務條款',
      });
    }
  }, [form, triggerError]);

  return (
    <Form {...form}>
      <form className="max-w-md p-4">
        <TermsOfServiceCheckbox control={form.control} />
      </form>
    </Form>
  );
};

export const Unchecked: Story = {
  render: () => <CheckboxWrapper defaultChecked={false} />,
};

export const Checked: Story = {
  render: () => <CheckboxWrapper defaultChecked={true} />,
};

export const ValidationError: Story = {
  render: () => <CheckboxWrapper defaultChecked={false} triggerError={true} />,
};

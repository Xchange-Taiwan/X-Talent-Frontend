import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { FormMockWrapper } from '@/test/mocks/FormMockWrapper';

import ForgotPasswordLink from './ForgotPasswordLink';

const meta: Meta<typeof ForgotPasswordLink> = {
  title: '業務模組元件/會員驗證(Auth)/ForgotPasswordLink',
  component: ForgotPasswordLink,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ForgotPasswordLink>;

export const Default: Story = {
  render: () => (
    <FormMockWrapper>
      <ForgotPasswordLink />
    </FormMockWrapper>
  ),
};

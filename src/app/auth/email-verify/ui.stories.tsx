import type { Meta, StoryObj } from '@storybook/nextjs';

import EmailVerificationPage from './ui';

const meta: Meta<typeof EmailVerificationPage> = {
  title: '業務模組元件/會員驗證(Auth)/EmailVerificationPage',
  component: EmailVerificationPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof EmailVerificationPage>;

export const PendingVerification: Story = {
  args: {
    onResendEmail: () => {},
    onNavigateHome: () => {},
  },
};

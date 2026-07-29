import type { Meta, StoryObj } from '@storybook/nextjs';

import AuthButton from './AuthButton';

const meta: Meta<typeof AuthButton> = {
  title: 'Components/Auth/AuthButton',
  component: AuthButton,
  tags: ['autodocs'],
  argTypes: {
    isSubmitting: {
      control: 'boolean',
      description: 'Whether the form is currently submitting',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthButton>;

export const Default: Story = {
  args: {
    isSubmitting: false,
    children: '登入',
  },
};

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    children: '登入',
  },
};

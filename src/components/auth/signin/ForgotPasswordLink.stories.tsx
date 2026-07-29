import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import ForgotPasswordLink from './ForgotPasswordLink';

const meta: Meta<typeof ForgotPasswordLink> = {
  title: 'Components/Auth/ForgotPasswordLink',
  component: ForgotPasswordLink,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ForgotPasswordLink>;

export const Default: Story = {
  render: () => <ForgotPasswordLink />,
};

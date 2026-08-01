import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Footer } from './Footer';

const meta: Meta<typeof Footer> = {
  title: '佈局元件/Footer',
  component: Footer,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {
  render: () => <Footer />,
};

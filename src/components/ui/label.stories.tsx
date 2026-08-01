import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: '基礎/原子元件/Label',
  component: Label,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: (args) => <Label {...args}>姓名 (Name)</Label>,
};

import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { DisabledAwareLink } from './DisabledAwareLink';

const meta: Meta<typeof DisabledAwareLink> = {
  title: 'Layout/Header/DisabledAwareLink',
  component: DisabledAwareLink,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the link is disabled',
    },
    href: {
      control: 'text',
      description: 'The destination URL',
    },
  },
  args: {
    href: '/mentor-pool',
    children: '尋找導師',
    disabled: false,
    className: 'text-brand-500 font-semibold hover:underline',
  },
};

export default meta;
type Story = StoryObj<typeof DisabledAwareLink>;

export const Default: Story = {
  args: {
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const CustomStyle: Story = {
  render: (args) => (
    <div className="flex gap-6">
      <DisabledAwareLink {...args} href="/about">
        關於我們 (正常)
      </DisabledAwareLink>
      <DisabledAwareLink {...args} href="/about" disabled>
        關於我們 (已停用)
      </DisabledAwareLink>
    </div>
  ),
};

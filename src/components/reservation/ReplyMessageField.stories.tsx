import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { ReplyMessageField } from './ReplyMessageField';

const meta: Meta<typeof ReplyMessageField> = {
  title: '業務模組元件/預約管理(Reservation)/ReplyMessageField',
  component: ReplyMessageField,
  tags: ['autodocs'],
  args: {
    open: false,
    onOpen: () => {},
    disabled: false,
    textareaProps: {},
  },
};

export default meta;
type Story = StoryObj<typeof ReplyMessageField>;

export const Collapsed: Story = {
  args: {
    open: false,
  },
  render: function CollapsedRender(args) {
    const [open, setOpen] = useState(args.open);
    return (
      <div className="max-w-md p-4">
        <ReplyMessageField {...args} open={open} onOpen={() => setOpen(true)} />
      </div>
    );
  },
};

export const Expanded: Story = {
  args: {
    open: true,
  },
};

export const WithValidationError: Story = {
  args: {
    open: true,
    error: '回覆訊息不可超過 500 字',
    textareaProps: {
      defaultValue: '這是一段測試回覆訊息...',
    },
  },
};

export const Disabled: Story = {
  args: {
    open: true,
    disabled: true,
    textareaProps: {
      defaultValue: '送出處理中，暫時鎖定輸入框。',
    },
  },
};

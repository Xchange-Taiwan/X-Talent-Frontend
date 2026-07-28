import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Components/UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'file'],
      description: 'The native input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    readOnly: {
      control: 'boolean',
      description: 'Whether the input is read-only',
    },
    placeholder: {
      control: 'text',
      description: 'The placeholder text of the input',
    },
  },
  args: {
    type: 'text',
    disabled: false,
    readOnly: false,
    placeholder: '請輸入內容...',
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    placeholder: '請在此輸入文字...',
  },
};

// 2. Different Input Types Comparison
export const InputTypes: Story = {
  render: (args: React.ComponentProps<typeof Input>) => (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">純文字輸入 (Text)</label>
        <Input {...args} type="text" placeholder="請輸入姓名" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">電子信箱 (Email)</label>
        <Input {...args} type="email" placeholder="example@xchange.tw" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">密碼欄位 (Password)</label>
        <Input
          {...args}
          type="password"
          placeholder="請輸入密碼"
          defaultValue="supersecret123"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">數字欄位 (Number)</label>
        <Input {...args} type="number" placeholder="25" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">檔案上傳 (File)</label>
        <Input {...args} type="file" />
      </div>
    </div>
  ),
};

// 3. Native Disabled & ReadOnly States
export const SpecialStates: Story = {
  render: (args: React.ComponentProps<typeof Input>) => (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">禁用狀態 (Disabled)</label>
        <Input {...args} disabled placeholder="已被禁用的輸入框" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">唯讀狀態 (Read-Only)</label>
        <Input {...args} readOnly defaultValue="這是唯讀的內容，不可修改" />
      </div>
    </div>
  ),
};

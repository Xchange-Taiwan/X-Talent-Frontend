import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: '基礎/原子元件/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'file'],
      description: '原生輸入框的 type 屬性',
    },
    disabled: {
      control: 'boolean',
      description: '輸入框是否已被禁用',
    },
    readOnly: {
      control: 'boolean',
      description: '輸入框是否為唯讀',
    },
    placeholder: {
      control: 'text',
      description: '輸入框的預設提示文字 (placeholder)',
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
        <label htmlFor="text-input" className="text-sm font-medium">
          純文字輸入 (Text)
        </label>
        <Input {...args} id="text-input" type="text" placeholder="請輸入姓名" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-input" className="text-sm font-medium">
          電子信箱 (Email)
        </label>
        <Input
          {...args}
          id="email-input"
          type="email"
          placeholder="example@xchange.tw"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password-input" className="text-sm font-medium">
          密碼欄位 (Password)
        </label>
        <Input
          {...args}
          id="password-input"
          type="password"
          placeholder="請輸入密碼"
          defaultValue="supersecret123"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="number-input" className="text-sm font-medium">
          數字欄位 (Number)
        </label>
        <Input {...args} id="number-input" type="number" placeholder="25" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file-input" className="text-sm font-medium">
          檔案上傳 (File)
        </label>
        <Input {...args} id="file-input" type="file" />
      </div>
    </div>
  ),
};

// 3. Native Disabled & ReadOnly States
export const SpecialStates: Story = {
  render: (args: React.ComponentProps<typeof Input>) => (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="disabled-input" className="text-sm font-medium">
          禁用狀態 (Disabled)
        </label>
        <Input
          {...args}
          id="disabled-input"
          disabled
          placeholder="已被禁用的輸入框"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="readonly-input" className="text-sm font-medium">
          唯讀狀態 (Read-Only)
        </label>
        <Input
          {...args}
          id="readonly-input"
          readOnly
          defaultValue="這是唯讀的內容，不可修改"
        />
      </div>
    </div>
  ),
};

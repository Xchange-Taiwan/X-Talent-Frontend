import type { Meta, StoryObj } from '@storybook/nextjs';

import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: '基礎/原子元件/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '文字輸入區域是否已被禁用',
    },
    placeholder: {
      control: 'text',
      description: '文字輸入區域的預設提示文字 (placeholder)',
    },
  },
  args: {
    disabled: false,
    placeholder: '請輸入內容...',
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    placeholder: '在此輸入您的自傳或專案描述...',
  },
};

// 2. Disabled Textarea
export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: '這是已被禁用的文字輸入區域，不可修改。',
  },
};

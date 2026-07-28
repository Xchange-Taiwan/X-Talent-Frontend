import type { Meta, StoryObj } from '@storybook/nextjs';

import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
    },
    placeholder: {
      control: 'text',
      description: 'The placeholder text of the textarea',
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

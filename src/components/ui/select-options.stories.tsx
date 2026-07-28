import type { Meta, StoryObj } from '@storybook/nextjs';

import { SelectOptions } from './select-options';

const meta: Meta<typeof SelectOptions> = {
  title: 'Components/UI/SelectOptions',
  component: SelectOptions,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SelectOptions>;

// 1. Basic Interactive Demo
export const Default: Story = {
  args: {
    selectItemData: {
      label: '請選擇您的專業領域',
      placeholder: '選擇領域',
      options: ['UI/UX 設計', '前端開發', '後端開發', '產品管理', '行銷企劃'],
    },
  },
};

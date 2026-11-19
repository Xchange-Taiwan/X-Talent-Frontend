import type { Meta, StoryObj } from '@storybook/nextjs';

import { ExperienceReorderHeader } from './ExperienceReorderHeader';

const meta: Meta<typeof ExperienceReorderHeader> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/ExperienceReorderHeader',
  component: ExperienceReorderHeader,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ExperienceReorderHeader>;

export const MultipleItems: Story = {
  args: {
    index: 0,
    total: 2,
    itemLabel: '工作經驗',
    onMove: () => {},
  },
};

export const SingleItem: Story = {
  args: {
    index: 0,
    total: 1,
    itemLabel: '工作經驗',
    onMove: () => {},
  },
};

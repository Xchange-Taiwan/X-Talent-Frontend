import type { Meta, StoryObj } from '@storybook/nextjs';

import { MenteeSummaryBar } from './MenteeSummaryBar';

const meta: Meta<typeof MenteeSummaryBar> = {
  title: '業務模組元件/個人檔案(Profile)/MenteeSummaryBar',
  component: MenteeSummaryBar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MenteeSummaryBar>;

export const Default: Story = {
  args: {
    yearsOfExperience: '1~3 年',
    location: '臺灣',
    directionCount: 2,
  },
};

export const MissingFieldsFallback: Story = {
  args: {
    yearsOfExperience: undefined,
    location: undefined,
    directionCount: 0,
  },
};

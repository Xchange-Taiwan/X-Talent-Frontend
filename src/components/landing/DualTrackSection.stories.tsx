import type { Meta, StoryObj } from '@storybook/nextjs';

import { DualTrackSection } from './DualTrackSection';

const meta: Meta<typeof DualTrackSection> = {
  title: '業務模組元件/首頁(Landing)/DualTrackSection',
  component: DualTrackSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DualTrackSection>;

export const Default: Story = {
  name: '預覽雙軌橫幅 (forceVisible)',
  args: {
    forceVisible: true,
  },
};

export const ReleaseDefaultHidden: Story = {
  name: '發版預設隱藏狀態 (#970)',
  args: {
    forceVisible: false,
  },
};

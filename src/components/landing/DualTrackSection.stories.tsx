import type { Meta, StoryObj } from '@storybook/nextjs';

import { DualTrackSection } from './DualTrackSection';

const meta: Meta<typeof DualTrackSection> = {
  title: '業務模組元件/首頁(Landing)/DualTrackSection',
  component: DualTrackSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DualTrackSection>;

export const Default: Story = {};

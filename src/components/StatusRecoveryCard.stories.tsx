import type { Meta, StoryObj } from '@storybook/nextjs';

import StatusRecoveryCard from './StatusRecoveryCard';

const meta: Meta<typeof StatusRecoveryCard> = {
  title: 'System/StatusRecoveryCard',
  component: StatusRecoveryCard,
};

export default meta;
type Story = StoryObj<typeof StatusRecoveryCard>;

export const DefaultCard: Story = {
  args: {
    title: '畫面載入發生異常',
    description: '請重新整理頁面或返回首頁繼續操作。',
    actions: (
      <span className="text-brand-500 text-sm font-semibold">返回首頁</span>
    ),
  },
};

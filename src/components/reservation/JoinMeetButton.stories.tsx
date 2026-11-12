import type { Meta, StoryObj } from '@storybook/nextjs';

import { JoinMeetButton } from './JoinMeetButton';

const meta: Meta<typeof JoinMeetButton> = {
  title: '業務模組元件/預約管理(Reservation)/JoinMeetButton',
  component: JoinMeetButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '共用於預約列表卡片與確認預約彈窗的「加入 Google Meet」按鈕，內建 `reservation_join_meet_click` 宣告式埋點（依 `sourceRole` 與 `analyticsLocation` 輸出語意參數，嚴格不外洩會議網址）。',
      },
    },
  },
  args: {
    onClick: () => {},
    isPending: false,
    disabled: false,
    analyticsLocation: 'reservation_card',
  },
};

export default meta;
type Story = StoryObj<typeof JoinMeetButton>;

export const Default: Story = {};

export const MentorReservationCard: Story = {
  args: {
    sourceRole: 'mentor',
    analyticsLocation: 'reservation_card',
  },
};

export const MenteeConfirmedDialog: Story = {
  args: {
    sourceRole: 'mentee',
    analyticsLocation: 'confirmed_reservation_dialog',
  },
};

export const PendingState: Story = {
  args: {
    isPending: true,
    sourceRole: 'mentee',
  },
};

export const DisabledState: Story = {
  args: {
    disabled: true,
    sourceRole: 'mentor',
  },
};

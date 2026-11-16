import type { Meta, StoryObj } from '@storybook/nextjs';

import AcceptReservationDialog from './AcceptReservationDialog';
import { mockReservation } from './mocks';

const meta: Meta<typeof AcceptReservationDialog> = {
  title: '業務模組元件/預約系統(Reservation)/AcceptReservationDialog',
  component: AcceptReservationDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '導師端接受學員預約的確認對話框。顯示學員基本資訊、預約日期時段、學員提問內容，並提供可選填的回覆訊息欄位（透過共用的 `quickReplyFormSchema` 驗證上限 500 字）。點擊觸發按鈕即可開啟 Dialog 預覽。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '是否禁用按鈕與互動',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AcceptReservationDialog>;

export const Default: Story = {
  args: {
    reservation: mockReservation,
    myUserId: 'mentor-1',
    disabled: false,
    onAccept: async (payload) => {
      console.log('onAccept called with payload:', payload);
    },
  },
};

export const Disabled: Story = {
  args: {
    reservation: mockReservation,
    myUserId: 'mentor-1',
    disabled: true,
  },
};

export const WithoutMenteeMessage: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
    },
    myUserId: 'mentor-1',
    disabled: false,
    onAccept: async (payload) => {
      console.log('onAccept called with payload:', payload);
    },
  },
};

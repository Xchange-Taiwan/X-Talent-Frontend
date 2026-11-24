import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockReservation } from './mocks';
import { ReservationReasonDialog } from './ReservationReasonDialog';

const meta: Meta<typeof ReservationReasonDialog> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationReasonDialog',
  component: ReservationReasonDialog,
  parameters: {
    docs: {
      description: {
        component:
          '拒絕／取消預約共用的「原因必填」確認彈窗（#977）。以 `kind` 切換文案與 `feature_opened` 埋點，統一使用無雙層分離的 `FOCUS_WITHIN_RING_NO_OFFSET_CLASSES` 聚焦框；`onSubmit` 回傳具名 `{ ok: false }` 結果時保持開啟，錯誤 Toast 由 `useReservationActions` 單一轉接器負責。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['reject', 'cancel'],
      description: '彈窗種類：導師拒絕或雙方取消',
    },
    disabled: {
      control: 'boolean',
      description: '對話框的觸發器與操作按鈕是否已被禁用',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReservationReasonDialog>;

export const Reject: Story = {
  args: {
    kind: 'reject',
    reservation: mockReservation,
    onSubmit: async (payload) => {
      console.log('reject submitted:', payload.id);
      return { ok: true };
    },
  },
};

export const Cancel: Story = {
  args: {
    kind: 'cancel',
    reservation: mockReservation,
    onSubmit: async (payload) => {
      console.log('cancel submitted:', payload.id);
      return { ok: true };
    },
  },
};

// Submitting: the promise stays pending for 10s, locking dismissal and showing the spinner.
export const Submitting: Story = {
  args: {
    kind: 'cancel',
    reservation: mockReservation,
    onSubmit: () => new Promise((resolve) => setTimeout(resolve, 10000)),
  },
};

// A named version_conflict result keeps the dialog (and the typed reason) open.
export const DecisionFailedStaysOpen: Story = {
  args: {
    kind: 'reject',
    reservation: mockReservation,
    onSubmit: async () => ({
      ok: false,
      kind: 'reject',
      reason: 'version_conflict',
      message: '資料已被更新，請重新確認後再試一次',
    }),
  },
};

export const Disabled: Story = {
  args: {
    kind: 'reject',
    reservation: mockReservation,
    disabled: true,
  },
};

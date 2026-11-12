import type { Meta, StoryObj } from '@storybook/nextjs';

import { UNPUBLICIZED_FEEDBACK_NOTICE } from '@/lib/reservation/resolveHistoryFeedbackState';

import { ReservationFeedbackBlock } from './ReservationFeedbackBlock';

const meta: Meta<typeof ReservationFeedbackBlock> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationFeedbackBlock',
  component: ReservationFeedbackBlock,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ReservationFeedbackBlock>;

export const MenteePublicRating: Story = {
  args: {
    model: {
      kind: 'public-rating',
      label: '我的評價',
      rating: 10,
      content: '導師給了非常具體的作品集優化方向，讓我對轉職準備更有信心！',
      canEdit: true,
    },
  },
};

export const MentorPublicRating: Story = {
  args: {
    model: {
      kind: 'public-rating',
      label: '學員評價',
      rating: 9,
      content: '問題拆解清晰、建議可立即落地，非常感謝導師撥空指導。',
      canEdit: false,
    },
  },
};

export const MenteeUnpublicizedRating: Story = {
  args: {
    model: {
      kind: 'unpublicized',
      rating: 8,
      content: '感謝導師分享職涯規劃建議。',
      notice: UNPUBLICIZED_FEEDBACK_NOTICE,
      canEdit: true,
    },
  },
};

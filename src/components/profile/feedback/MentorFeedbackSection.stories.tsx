import type { Meta, StoryObj } from '@storybook/nextjs';

import type { MentorFeedbackItem } from '@/types/feedback';

import { MentorFeedbackSection } from './MentorFeedbackSection';

const meta: Meta<typeof MentorFeedbackSection> = {
  title: '業務模組元件/個人檔案(Profile)/Feedback/MentorFeedbackSection',
  component: MentorFeedbackSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MentorFeedbackSection>;

const sampleItems: MentorFeedbackItem[] = [
  {
    id: 'fb-1',
    authorName: '陳**',
    rating: 9,
    content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
    createdAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'fb-2',
    authorName: '林**',
    rating: 8,
    content: '從作品集的架構到研究故事，都給了我可以實際執行的修改方向。',
    createdAt: '2026-10-27T14:30:00Z',
  },
  {
    id: 'fb-3',
    authorName: '王**',
    rating: 9,
    content: `很有耐心地回答問題，會談前也有先了解我的需求。
1. 履歷調整重點
2. 面試追問模擬`,
    createdAt: '2026-10-26T09:15:00Z',
  },
];

const paginatedItems: MentorFeedbackItem[] = Array.from(
  { length: 12 },
  (_, index) => ({
    id: `fb-page-${index + 1}`,
    authorName: `${['陳', '林', '王', '張', '李', '吳'][index % 6]}**`,
    rating: index % 2 === 0 ? 9 : 8,
    content: `第 ${index + 1} 則公開評價：提供了相當具體的職涯與作品集調整方向。`,
    createdAt: `2026-10-${String(28 - index).padStart(2, '0')}T10:00:00Z`,
  })
);

export const DefaultWithReviews: Story = {
  args: {
    items: sampleItems,
    totalRatingCount: 3,
    ratingAverage: 8.7,
  },
};

export const WithPaginationOverTen: Story = {
  args: {
    items: paginatedItems,
    totalRatingCount: 12,
    ratingAverage: 8.5,
  },
};

export const EmptyZeroReviews: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    ratingAverage: null,
  },
};

export const LoadingState: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    isLoading: true,
  },
};

export const ErrorWithRetry: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    error: '載入評價時發生錯誤，請稍後再試。',
    onRetry: () => {},
  },
};

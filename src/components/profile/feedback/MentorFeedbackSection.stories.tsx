import type { Meta, StoryObj } from '@storybook/nextjs';

import type { MentorFeedbackItem } from '@/types/feedback';

import { MentorFeedbackSection } from './MentorFeedbackSection';

const meta: Meta<typeof MentorFeedbackSection> = {
  title: '業務模組元件/個人檔案(Profile)/MentorFeedbackSection',
  component: MentorFeedbackSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorFeedbackSection>;

const sampleItems: MentorFeedbackItem[] = [
  {
    id: 'fb-1',
    authorName: '陳**',
    authorInitial: '陳',
    rating: 9,
    content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
    createdAt: '2026-10-28T12:00:00Z',
    formattedDate: '2026/10/28',
  },
  {
    id: 'fb-2',
    authorName: '林**',
    authorInitial: '林',
    rating: 8,
    content: '從作品集的架構到研究故事，都給了我可以實際執行的修改方向。',
    createdAt: '2026-10-27T12:00:00Z',
    formattedDate: '2026/10/27',
  },
  {
    id: 'fb-3',
    authorName: '王**',
    authorInitial: '王',
    rating: 9,
    content: '很有耐心地回答問題，會談前也有先了解我的需求。',
    createdAt: '2026-10-26T12:00:00Z',
    formattedDate: '2026/10/26',
  },
];

export const DefaultWithReviews: Story = {
  args: {
    items: sampleItems,
    totalRatingCount: 12,
    ratingAverage: 8.5,
    page: 1,
    totalPages: 2,
    isLoading: false,
    hasError: false,
    onPageChange: () => {},
  },
};

export const EmptyReviews: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    ratingAverage: null,
    page: 1,
    totalPages: 0,
    isLoading: false,
    hasError: false,
    onPageChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    ratingAverage: null,
    page: 1,
    totalPages: 0,
    isLoading: true,
    hasError: false,
    onPageChange: () => {},
  },
};

export const ErrorState: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    ratingAverage: null,
    page: 1,
    totalPages: 0,
    isLoading: false,
    hasError: true,
    onPageChange: () => {},
    onRetry: () => {},
  },
};

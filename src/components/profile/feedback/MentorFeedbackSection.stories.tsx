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

const longSampleReviewContent =
  '這次會談讓我重新整理了作品集的敘事方式。導師先聽我分享目前求職的方向，再一起檢視每個專案的問題、研究過程與成果。最有幫助的是，我們沒有只停留在畫面的修改，而是練習如何說明設計決策背後的原因，以及自己的貢獻。會談結束前，也一起列出了接下來兩週可以完成的三件事，讓原本有點混亂的準備過程變得有方向。謝謝導師很有耐心地追問細節，也分享了與產品和工程團隊合作的實際經驗。回去修改後，我更能清楚說明專案的取捨，也對下次面試多了一些信心。';

const paginatedItems: MentorFeedbackItem[] = Array.from(
  { length: 12 },
  (_, index) => ({
    id: `fb-page-${index + 1}`,
    authorName: `${['陳', '林', '王', '張', '李', '吳'][index % 6]}**`,
    rating: index % 2 === 0 ? 9 : 8,
    content:
      index === 0
        ? longSampleReviewContent
        : `第 ${index + 1} 則公開評價：提供了相當具體的職涯與作品集調整方向。`,
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

export const WithLongExpandableReviews: Story = {
  args: {
    items: [
      {
        id: 'fb-long-1',
        authorName: '陳**',
        rating: 9,
        content: longSampleReviewContent,
        createdAt: '2026-10-28T10:00:00Z',
      },
      ...sampleItems.slice(1),
    ],
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

export const ControlledPaginationPageTwo: Story = {
  args: {
    items: paginatedItems.slice(10, 12),
    totalRatingCount: 12,
    ratingAverage: 8.5,
    page: 2,
    pageSize: 10,
    onPageChange: () => {},
  },
};

export const PageTransitionLoading: Story = {
  args: {
    items: paginatedItems.slice(0, 10),
    totalRatingCount: 12,
    ratingAverage: 8.5,
    page: 2,
    pageSize: 10,
    isLoading: true,
    onPageChange: () => {},
  },
};

export const EmptyZeroReviews: Story = {
  args: {
    items: [],
    totalRatingCount: 0,
    ratingAverage: null,
  },
};

export const FallbackUnavailableWithStats: Story = {
  args: {
    items: [],
    totalRatingCount: 12,
    ratingAverage: 9.2,
    onRetry: () => {},
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

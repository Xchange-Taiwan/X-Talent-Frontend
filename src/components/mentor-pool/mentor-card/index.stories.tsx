import type { Meta, StoryObj } from '@storybook/nextjs';

import defaultAvatar from '@/assets/default-avatar.png';

import { MentorCard } from './index';

const meta: Meta<typeof MentorCard> = {
  title: 'Components/MentorPool/MentorCard',
  component: MentorCard,
  tags: ['autodocs'],
  args: {
    id: 1,
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    years: 'THREE_TO_FIVE',
    name: '陳怡君 (Jane Chen)',
    job_title: 'Senior UI/UX Designer',
    company: 'Google',
    about:
      '擁有 8 年以上數位產品設計經驗，曾主導多個跨國 B2B 與 B2C 產品的設計與優化。熱衷於使用者研究、資訊架構與互動設計。',
    haveTopicLabels: [
      'UI/UX 設計',
      '使用者研究',
      '產品規劃',
      '職涯諮詢',
      '求職履歷優化',
    ],
    priority: false,
  },
  argTypes: {
    years: {
      control: 'select',
      options: [
        'BELOW_ONE_YEAR',
        'ONE_TO_THREE',
        'THREE_TO_FIVE',
        'FIVE_TO_TEN',
        'OVER_TEN_YEAR',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorCard>;

export const Default: Story = {
  args: {
    id: 1,
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    years: 'THREE_TO_FIVE',
    name: '陳怡君 (Jane Chen)',
    job_title: 'Senior UI/UX Designer',
    company: 'Google',
    about:
      '擁有 8 年以上數位產品設計經驗，曾主導多個跨國 B2B 與 B2C 產品的設計與優化。熱衷於使用者研究、資訊架構與互動設計。',
    haveTopicLabels: [
      'UI/UX 設計',
      '使用者研究',
      '產品規劃',
      '職涯諮詢',
      '求職履歷優化',
    ],
  },
};

export const FrontendEngineer: Story = {
  args: {
    id: 2,
    avatar: defaultAvatar,
    years: 'FIVE_TO_TEN',
    name: '王小明 (John Wang)',
    job_title: 'Senior Frontend Engineer',
    company: 'TSMC',
    about:
      '專注於 React/Next.js 前端開發、效能優化與前端架構設計。熱於分享技術與指導新人。',
    haveTopicLabels: [
      'Frontend',
      'React',
      'TypeScript',
      'Performance Optimization',
    ],
  },
};

export const StaffProductManager: Story = {
  args: {
    id: 3,
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    years: 'OVER_TEN_YEAR',
    name: '林建宏 (Alex Lin)',
    job_title: 'Staff Product Manager',
    company: 'TSMC',
    about:
      '超過 12 年跨國科技大廠專案與產品管理實務，專精於敏捷開發導入、團隊流程重塑與大規模系統規劃。',
    haveTopicLabels: [
      'Agile PM',
      'Scrum',
      'Product Strategy',
      'System Architecture',
      'Career Coaching',
    ],
  },
};

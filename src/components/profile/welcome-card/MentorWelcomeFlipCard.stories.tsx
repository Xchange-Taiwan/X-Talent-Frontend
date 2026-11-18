import type { Meta, StoryObj } from '@storybook/nextjs';

import defaultAvatar from '@/assets/default-avatar.png';
import type { UserType } from '@/hooks/user/user-data/useUserData';

import { MentorWelcomeFlipCard } from './MentorWelcomeFlipCard';

const meta: Meta<typeof MentorWelcomeFlipCard> = {
  title: '業務模組元件/個人檔案(Profile)/MentorWelcomeFlipCard',
  component: MentorWelcomeFlipCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorWelcomeFlipCard>;

const sampleMentor: UserType = {
  user_id: 101,
  name: 'Zahra Mirzakhani',
  avatar: defaultAvatar.src,
  job_title: 'Senior UX Designer',
  company: 'CreativeUX Design Studio',
  is_mentor: true,
  about:
    '目前在 CreativeUX Design Studio 擔任 Senior UX Designer，累積超過七年的數位產品設計經驗。喜歡從使用者研究出發，將複雜問題轉化為清楚、實用的產品體驗。',
  location: '臺灣',
  years_of_experience: '5~10 年',
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_topic: [
    { subject_group: 'resume', subject: '履歷健檢' },
    { subject_group: 'portfolio', subject: '作品集檢視' },
    { subject_group: 'career', subject: '職涯規劃' },
  ],
  have_skill: [
    { subject_group: 'ui', subject: 'UI Design' },
    { subject_group: 'ux', subject: 'UX Research' },
    { subject_group: 'ds', subject: '設計系統' },
  ],
};

export const FrontFace: Story = {
  args: {
    userData: sampleMentor,
    defaultFlipped: false,
  },
};

export const BackFace: Story = {
  args: {
    userData: sampleMentor,
    defaultFlipped: true,
  },
};

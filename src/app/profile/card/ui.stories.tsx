import type { Meta, StoryObj } from '@storybook/nextjs';

import type { UserType } from '@/hooks/user/user-data/useUserData';

import ProfileCardUI from './ui';

const meta: Meta<typeof ProfileCardUI> = {
  title: '業務模組元件/個人檔案(Profile)/ProfileCardUI',
  component: ProfileCardUI,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ProfileCardUI>;

const mockMenteeUserData: UserType = {
  user_id: 201,
  name: '陳大明 Alex Chen',
  avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=alex',
  job_title: 'Junior Web Developer',
  company: 'Startup Studio',
  is_mentor: false,
  want_position: [
    { subject_group: 'want-fe', subject: '前端工程師' },
    { subject_group: 'want-fs', subject: '全端工程師' },
  ],
  want_skill: [
    { subject_group: 'want-react', subject: 'React' },
    { subject_group: 'want-ts', subject: 'TypeScript' },
    { subject_group: 'want-sys', subject: 'System Design' },
  ],
  want_topic: [
    { subject_group: 'topic-transition', subject: '轉職經驗分享' },
    { subject_group: 'topic-resume', subject: '履歷健檢' },
  ],
  have_skill: [],
  have_topic: [],
};

const mockMentorUserData: UserType = {
  user_id: 101,
  name: '林小華 Hana Lin',
  avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
  job_title: 'Senior Frontend Engineer',
  company: 'Google',
  is_mentor: true,
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [
    { subject_group: 'fe-react', subject: 'React' },
    { subject_group: 'fe-ts', subject: 'TypeScript' },
    { subject_group: 'fe-next', subject: 'Next.js' },
  ],
  have_topic: [
    { subject_group: 'offer-resume', subject: '履歷健檢' },
    { subject_group: 'offer-mock', subject: '模擬面試' },
    { subject_group: 'offer-career', subject: '職涯發展諮詢' },
  ],
};

export const MenteeCompletedView: Story = {
  args: {
    userData: mockMenteeUserData,
    isMentor: false,
    linkedinUrl: 'https://www.linkedin.com/in/alex-chen',
    onBecomeMentor: () => {},
    onGoToMentorPool: () => {},
    onBackToProfile: () => {},
  },
};

export const MentorCompletedView: Story = {
  args: {
    userData: mockMentorUserData,
    isMentor: true,
    linkedinUrl: 'https://www.linkedin.com/in/hana-lin',
    onBecomeMentor: () => {},
    onGoToMentorPool: () => {},
    onBackToProfile: () => {},
  },
};

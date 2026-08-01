import type { Meta, StoryObj } from '@storybook/nextjs';

import { ProfileBadgeSection } from './ProfileBadgeSection';

const meta: Meta<typeof ProfileBadgeSection> = {
  title: '業務模組元件/個人檔案(Profile)/ProfileBadgeSection',
  component: ProfileBadgeSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileBadgeSection>;

export const MentorExpertise: Story = {
  args: {
    title: '專業能力',
    items: [
      { subject_group: 'fe-react', subject: 'React' },
      { subject_group: 'fe-ts', subject: 'TypeScript' },
      { subject_group: 'fe-next', subject: 'Next.js' },
      { subject_group: 'perf', subject: 'Web Performance' },
      { subject_group: 'css-tailwind', subject: 'Tailwind CSS' },
    ],
  },
};

export const MentorServices: Story = {
  args: {
    title: '我能提供的服務',
    items: [
      { subject_group: 'offer-resume', subject: '履歷健檢' },
      { subject_group: 'offer-mock', subject: '模擬面試' },
      { subject_group: 'offer-arch', subject: '前端架構設計' },
      { subject_group: 'offer-career', subject: '職涯發展諮詢' },
    ],
  },
};

export const MenteeInterestedRoles: Story = {
  args: {
    title: '有興趣多了解的職位',
    items: [
      { subject_group: 'want-fe', subject: 'Frontend Engineer' },
      { subject_group: 'want-fs', subject: 'Fullstack Engineer' },
    ],
  },
};

export const MenteeSkillEnhancement: Story = {
  args: {
    title: '想多了解、加強的技能',
    items: [
      { subject_group: 'want-rn', subject: 'React Native' },
      { subject_group: 'want-sys', subject: 'System Design' },
      { subject_group: 'want-gql', subject: 'GraphQL' },
    ],
  },
};

export const MenteeTalkTopics: Story = {
  args: {
    title: '想多了解的主題',
    items: [
      { subject_group: 'topic-transition', subject: '轉職經驗分享' },
      { subject_group: 'topic-comm', subject: '團隊溝通技巧' },
      { subject_group: 'topic-tech', subject: '技術選型' },
    ],
  },
};

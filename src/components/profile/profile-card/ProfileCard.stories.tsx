import type { Meta, StoryObj } from '@storybook/nextjs';

import { ProfileCard } from './ProfileCard';

const meta: Meta<typeof ProfileCard> = {
  title: 'Components/Profile/ProfileCard',
  component: ProfileCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileCard>;

export const Mentor: Story = {
  args: {
    name: '林小華 Hana Lin',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
    jobTitle: 'Senior Frontend Engineer',
    company: 'Google',
    linkedinUrl: 'https://www.linkedin.com/in/hana-lin',
    expertise: [
      { subject_group: 'fe-react', subject: 'React' },
      { subject_group: 'fe-ts', subject: 'TypeScript' },
      { subject_group: 'fe-next', subject: 'Next.js' },
      { subject_group: 'perf', subject: 'Web Performance' },
      { subject_group: 'css-tailwind', subject: 'Tailwind CSS' },
    ],
    whatIOffer: [
      { subject_group: 'offer-resume', subject: '履歷健檢' },
      { subject_group: 'offer-mock', subject: '模擬面試' },
      { subject_group: 'offer-arch', subject: '前端架估設計' },
      { subject_group: 'offer-career', subject: '職涯發展諮詢' },
    ],
  },
};

export const Mentee: Story = {
  args: {
    name: '陳大明 Alex Chen',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=alex',
    jobTitle: 'Junior Web Developer',
    company: 'Startup Studio',
    linkedinUrl: 'https://www.linkedin.com/in/alex-chen',
    interestedRole: [
      { subject_group: 'want-fe', subject: 'Frontend Engineer' },
      { subject_group: 'want-fs', subject: 'Fullstack Engineer' },
    ],
    skillEnhancementTarget: [
      { subject_group: 'want-rn', subject: 'React Native' },
      { subject_group: 'want-sys', subject: 'System Design' },
      { subject_group: 'want-gql', subject: 'GraphQL' },
    ],
    talkTopic: [
      { subject_group: 'topic-transition', subject: '轉職經驗分享' },
      { subject_group: 'topic-comm', subject: '團隊溝通技巧' },
      { subject_group: 'topic-tech', subject: '技術選型' },
    ],
  },
};

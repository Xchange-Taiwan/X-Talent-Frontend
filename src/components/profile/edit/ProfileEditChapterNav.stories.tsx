import type { Meta, StoryObj } from '@storybook/nextjs';

import { ProfileEditChapterNav } from './ProfileEditChapterNav';

const meta: Meta<typeof ProfileEditChapterNav> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/ProfileEditChapterNav',
  component: ProfileEditChapterNav,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileEditChapterNav>;

export const MentorChapters: Story = {
  args: {
    isMentor: true,
  },
};

export const MenteeChapters: Story = {
  args: {
    isMentor: false,
  },
};

export const ActiveExpertiseChapter: Story = {
  name: '指定選中章節 (服務與專長)',
  args: {
    isMentor: true,
    activeChapterId: 'mentor-expertise',
  },
};

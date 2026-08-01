import type { Meta, StoryObj } from '@storybook/nextjs';

import { EditPageHeader } from './EditPageHeader';

const meta: Meta<typeof EditPageHeader> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/EditPageHeader',
  component: EditPageHeader,
  tags: ['autodocs'],
  args: {
    isSaving: false,
    isMentorOnboarding: false,
    onBack: () => console.log('Back button clicked'),
  },
};

export default meta;

type Story = StoryObj<typeof EditPageHeader>;

export const EditProfile: Story = {
  name: '編輯個人頁面',
  args: {
    isMentorOnboarding: false,
    isSaving: false,
  },
};

export const MentorOnboarding: Story = {
  name: '導師完成個人資料',
  args: {
    isMentorOnboarding: true,
    isSaving: false,
  },
};

export const Saving: Story = {
  name: '儲存中狀態',
  args: {
    isMentorOnboarding: false,
    isSaving: true,
  },
};

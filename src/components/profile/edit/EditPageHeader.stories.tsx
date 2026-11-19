import type { Meta, StoryObj } from '@storybook/nextjs';

import { EditPageHeader } from './EditPageHeader';

const meta: Meta<typeof EditPageHeader> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/EditPageHeader',
  component: EditPageHeader,
  tags: ['autodocs'],
  args: {
    isSaving: false,
    isMentorOnboarding: false,
    isMentor: false,
    onBack: () => console.log('Back button clicked'),
  },
};

export default meta;

type Story = StoryObj<typeof EditPageHeader>;

export const EditProfile: Story = {
  name: '學員編輯個人資訊',
  args: {
    isMentorOnboarding: false,
    isMentor: false,
    isSaving: false,
  },
};

export const MentorEditProfile: Story = {
  name: '導師編輯導師資料',
  args: {
    isMentorOnboarding: false,
    isMentor: true,
    isSaving: false,
  },
};

export const MentorOnboarding: Story = {
  name: '導師建立導師資料 (D-1 已勾選規範)',
  args: {
    isMentorOnboarding: true,
    isMentor: true,
    isSaving: false,
    submitDisabled: false,
  },
};

export const MentorOnboardingDisabledBeforeGuidelines: Story = {
  name: '導師建立導師資料 (D-1 未勾選規範禁用儲存並建立)',
  args: {
    isMentorOnboarding: true,
    isMentor: true,
    isSaving: false,
    submitDisabled: true,
  },
};

export const Saving: Story = {
  name: '儲存中狀態',
  args: {
    isMentorOnboarding: false,
    isSaving: true,
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs';

import { AvatarCard } from './AvatarCard';

const meta: Meta<typeof AvatarCard> = {
  title: '業務模組元件/個人檔案(Profile)/AvatarCard',
  component: AvatarCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AvatarCard>;

export const Default: Story = {
  args: {
    name: '林小華 Hana Lin',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
    personalLinks: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
    ],
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

export const MultiplePlatformLinks: Story = {
  args: {
    name: '林小華 Hana Lin',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
    personalLinks: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
      { platform: 'facebook', url: 'https://www.facebook.com/hana-lin' },
      { platform: 'instagram', url: 'https://www.instagram.com/hana.lin' },
      { platform: 'twitter', url: 'https://x.com/hanalin' },
      { platform: 'youtube', url: 'https://www.youtube.com/@hanalin' },
      { platform: 'website', url: 'https://hanalin.dev' },
    ],
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

export const NoPersonalLinks: Story = {
  args: {
    name: '林小華 Hana Lin',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

export const NoCompanyJob: Story = {
  args: {
    name: '林小華 Hana Lin',
    avatarImgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=hana',
    personalLinks: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
      { platform: 'website', url: 'https://hanalin.dev' },
    ],
  },
};

export const DefaultAvatar: Story = {
  args: {
    name: '林小華 Hana Lin',
    personalLinks: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/hana-lin' },
      { platform: 'twitter', url: 'https://x.com/hanalin' },
    ],
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

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
    linkedinUrl: 'https://www.linkedin.com/in/hana-lin',
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

export const NoLinkedIn: Story = {
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
    linkedinUrl: 'https://www.linkedin.com/in/hana-lin',
  },
};

export const DefaultAvatar: Story = {
  args: {
    name: '林小華 Hana Lin',
    linkedinUrl: 'https://www.linkedin.com/in/hana-lin',
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Google',
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { AvatarCard } from '../avatar-card';
import { ProfileBanner } from './ProfileBanner';

const meta: Meta<typeof ProfileBanner> = {
  title: '業務模組元件/個人檔案(Profile)/ProfileBanner',
  component: ProfileBanner,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative pt-10 pb-60">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileBanner>;

export const Default: Story = {};

export const WithMentorCard: Story = {
  render: (args) => (
    <ProfileBanner {...args}>
      <AvatarCard
        className="absolute -bottom-56 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:-bottom-40 sm:left-[180px]"
        name="林小華 Hana Lin"
        avatarImgUrl="https://api.dicebear.com/7.x/adventurer/svg?seed=hana"
        jobTitle="Senior Frontend Engineer"
        companyName="Google"
        linkedinUrl="https://www.linkedin.com/in/hana-lin"
      />
    </ProfileBanner>
  ),
};

export const WithMenteeCard: Story = {
  render: (args) => (
    <ProfileBanner {...args}>
      <AvatarCard
        className="absolute -bottom-56 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:-bottom-40 sm:left-[180px]"
        name="陳大明 Alex Chen"
        avatarImgUrl="https://api.dicebear.com/7.x/adventurer/svg?seed=alex"
        jobTitle="Junior Web Developer"
        companyName="Startup Studio"
        linkedinUrl="https://www.linkedin.com/in/alex-chen"
      />
    </ProfileBanner>
  ),
};

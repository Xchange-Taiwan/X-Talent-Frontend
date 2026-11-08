import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  createProfileFormSchema,
  defaultValues,
} from '@/schemas/profileSchema';

import { LinksSection } from './LinkSection';
import { ProfileStoryWrapper } from './ProfileStoryWrapper';

const meta: Meta<typeof LinksSection> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/LinksSection',
  component: LinksSection,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof LinksSection>;

export const Default: Story = {
  name: '空白連結區塊',
  render: () => {
    const schema = createProfileFormSchema(false);
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={defaultValues}>
        {(form) => <LinksSection form={form} />}
      </ProfileStoryWrapper>
    );
  },
};

export const Filled: Story = {
  name: '已填寫連結區塊',
  render: () => {
    const schema = createProfileFormSchema(false);
    const filledValues = {
      ...defaultValues,
      linkedin: {
        id: 1,
        url: 'https://www.linkedin.com/in/testuser',
        platform: 'linkedin',
      },
      facebook: {
        id: 2,
        url: 'https://www.facebook.com/testuser',
        platform: 'facebook',
      },
      instagram: {
        id: 3,
        url: 'https://www.instagram.com/testuser',
        platform: 'instagram',
      },
      twitter: { id: 4, url: 'https://x.com/testuser', platform: 'twitter' },
      youtube: {
        id: 5,
        url: 'https://www.youtube.com/@testuser',
        platform: 'youtube',
      },
      website: { id: 6, url: 'https://mywebsite.com', platform: 'website' },
    };
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={filledValues}>
        {(form) => <LinksSection form={form} />}
      </ProfileStoryWrapper>
    );
  },
};

export const WithValidationErrors: Story = {
  name: '有格式錯誤狀態',
  render: () => {
    const schema = createProfileFormSchema(false);
    const invalidValues = {
      ...defaultValues,
      linkedin: {
        id: 1,
        url: 'https://www.invalid-linkedin.com',
        platform: 'linkedin',
      },
      twitter: { id: 4, url: 'not-a-valid-url', platform: 'twitter' },
    };
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={invalidValues}>
        {(form) => {
          // Trigger validation on mount to display errors immediately
          React.useEffect(() => {
            form.trigger();
          }, [form]);

          return <LinksSection form={form} />;
        }}
      </ProfileStoryWrapper>
    );
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useEffect } from 'react';

import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
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

function ValidationTriggeredLinksSection({
  form,
}: {
  form: ProfileFormContext;
}) {
  useEffect(() => {
    void form.trigger();
  }, [form]);

  return <LinksSection form={form} />;
}

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
      links: {
        linkedin: 'https://www.linkedin.com/in/testuser',
        facebook: 'https://www.facebook.com/testuser',
        instagram: 'https://www.instagram.com/testuser',
        twitter: 'https://x.com/testuser',
        youtube: 'https://www.youtube.com/@testuser',
        github: 'https://github.com/testuser',
        website: 'https://mywebsite.com',
      },
    };
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={filledValues}>
        {(form) => <LinksSection form={form} />}
      </ProfileStoryWrapper>
    );
  },
};

export const WithGithubLink: Story = {
  name: 'GitHub 與既有連結狀態',
  render: () => {
    const schema = createProfileFormSchema(true);
    const githubValues = {
      ...defaultValues,
      links: {
        ...defaultValues.links,
        facebook: 'https://www.facebook.com/testuser',
        github: 'https://github.com/testuser',
      },
    };
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={githubValues}>
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
      links: {
        ...defaultValues.links,
        linkedin: 'https://evil-linkedin.com/in/testuser',
        twitter: 'http://x.com/testuser',
        github: 'https://gitlab.com/testuser',
        website: 'not-a-valid-url',
      },
    };
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={invalidValues}>
        {(form) => <ValidationTriggeredLinksSection form={form} />}
      </ProfileStoryWrapper>
    );
  },
};

export const MenteeCardVariant: Story = {
  name: 'Mentee 原地編輯卡片樣式 (#828)',
  render: () => {
    const schema = createProfileFormSchema(false);
    return (
      <ProfileStoryWrapper schema={schema} defaultValues={defaultValues}>
        {(form) => <LinksSection form={form} cardVariant />}
      </ProfileStoryWrapper>
    );
  },
};

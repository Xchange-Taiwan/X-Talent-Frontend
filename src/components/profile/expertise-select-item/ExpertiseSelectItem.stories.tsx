import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { ProfileStoryWrapper } from '../edit/ProfileStoryWrapper';
import { ExpertiseSelectItem, formSchema } from './ExpertiseSelectItem';

const meta: Meta<typeof ExpertiseSelectItem> = {
  title: '業務模組元件/個人檔案(Profile)/ExpertiseSelectItem',
  component: ExpertiseSelectItem,
  tags: ['autodocs'],
  args: {
    type: 'UI Design',
  },
};

export default meta;

type Story = StoryObj<typeof ExpertiseSelectItem>;

// Helper wrapper to provide the Form context
const ExpertiseWithForm = (props: {
  type: 'UI Design' | 'UX Design' | 'SEO Writing' | 'Graphic Design';
  initialSelected?: (
    'UI Design' | 'UX Design' | 'SEO Writing' | 'Graphic Design'
  )[];
}) => {
  return (
    <ProfileStoryWrapper
      schema={formSchema}
      defaultValues={{
        expertise: props.initialSelected ?? [],
      }}
    >
      {(form) => (
        <>
          <ExpertiseSelectItem type={props.type} form={form} />
          <div className="rounded bg-background-bottom p-2 text-xs text-text-secondary">
            目前表單選中: {JSON.stringify(form.watch('expertise'))}
          </div>
        </>
      )}
    </ProfileStoryWrapper>
  );
};

// ==========================================
// 1. Read-Only (Without Form context)
// ==========================================

export const UIDesignReadOnly: Story = {
  args: {
    type: 'UI Design',
  },
};

export const UXDesignReadOnly: Story = {
  args: {
    type: 'UX Design',
  },
};

export const SEOWritingReadOnly: Story = {
  args: {
    type: 'SEO Writing',
  },
};

export const GraphicDesignReadOnly: Story = {
  args: {
    type: 'Graphic Design',
  },
};

// ==========================================
// 2. Interactive (With Form context)
// ==========================================

export const InteractiveNotSelected: StoryObj<typeof ExpertiseSelectItem> = {
  render: () => <ExpertiseWithForm type="UI Design" initialSelected={[]} />,
};

export const InteractiveSelected: StoryObj<typeof ExpertiseSelectItem> = {
  render: () => (
    <ExpertiseWithForm type="UI Design" initialSelected={['UI Design']} />
  ),
};

export const InteractiveAllOptions: StoryObj<typeof ExpertiseSelectItem> = {
  render: () => {
    return (
      <ProfileStoryWrapper
        schema={formSchema}
        defaultValues={{
          expertise: ['UI Design'],
        }}
      >
        {(form) => (
          <div className="space-y-3">
            <h3 className="mb-2 text-sm font-semibold text-text-primary">
              請選擇您的專業領域 (可複選)
            </h3>
            <ExpertiseSelectItem type="UI Design" form={form} />
            <ExpertiseSelectItem type="UX Design" form={form} />
            <ExpertiseSelectItem type="SEO Writing" form={form} />
            <ExpertiseSelectItem type="Graphic Design" form={form} />
            <div className="rounded bg-background-bottom p-2 text-xs text-text-secondary">
              目前選中: {JSON.stringify(form.watch('expertise'))}
            </div>
          </div>
        )}
      </ProfileStoryWrapper>
    );
  },
};

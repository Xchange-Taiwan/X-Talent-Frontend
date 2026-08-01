import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { LocationType } from '@/services/profile/countries';
import { type IndustryOption } from '@/services/profile/tagCatalog';

import { step2Schema } from './index';
import { OnboardingStoryWrapper } from './OnboardingStoryWrapper';
import { PersonalInfo } from './PersonalInfo';

const mockLocations: LocationType[] = [
  { value: 'TWN', text: '台灣 (Taiwan)' },
  { value: 'USA', text: '美國 (United States)' },
  { value: 'JPN', text: '日本 (Japan)' },
  { value: 'SGP', text: '新加坡 (Singapore)' },
];

const mockIndustries: IndustryOption[] = [
  { subject_group: 'software_engineering', subject: '軟體工程' },
  { subject_group: 'finance_banking', subject: '金融/銀行' },
  { subject_group: 'design', subject: '設計' },
  { subject_group: 'marketing_pr', subject: '行銷/公關' },
];

const meta: Meta<typeof PersonalInfo> = {
  title: '業務模組元件/新手引導(Onboarding)/Steps/PersonalInfo',
  component: PersonalInfo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PersonalInfo>;

export const Empty: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step2Schema}
      defaultValues={{
        location: '',
        years_of_experience: '',
        industry: undefined,
      }}
    >
      {(form) => (
        <PersonalInfo
          form={form}
          locationOptions={mockLocations}
          industryOptions={mockIndustries}
        />
      )}
    </OnboardingStoryWrapper>
  ),
};

export const Filled: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step2Schema}
      defaultValues={{
        location: 'TWN',
        years_of_experience: '3~5 年',
        industry: 'software_engineering',
      }}
    >
      {(form) => (
        <PersonalInfo
          form={form}
          locationOptions={mockLocations}
          industryOptions={mockIndustries}
        />
      )}
    </OnboardingStoryWrapper>
  ),
};

export const ValidationError: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step2Schema}
      defaultValues={{
        location: '',
        years_of_experience: '',
        industry: undefined,
      }}
      triggerValidation={true}
    >
      {(form) => (
        <PersonalInfo
          form={form}
          locationOptions={mockLocations}
          industryOptions={mockIndustries}
        />
      )}
    </OnboardingStoryWrapper>
  ),
};

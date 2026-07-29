import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';
import { LocationType } from '@/services/profile/countries';
import { type IndustryOption } from '@/services/profile/tagCatalog';

import { step2Schema } from './index';
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

const PersonalInfoFormWrapper = ({
  initialValues,
  triggerValidation = false,
}: {
  initialValues?: {
    location?: string;
    years_of_experience?: string;
    industry?: string;
  };
  triggerValidation?: boolean;
}) => {
  const form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: initialValues?.location ?? '',
      years_of_experience: initialValues?.years_of_experience ?? '',
      industry: initialValues?.industry ?? undefined,
    },
  });

  useEffect(() => {
    if (triggerValidation) {
      form.trigger();
    }
  }, [triggerValidation, form]);

  return (
    <Form {...form}>
      <div className="max-w-md rounded-lg border border-border bg-background-white p-6 shadow-sm">
        <PersonalInfo
          form={form}
          locationOptions={mockLocations}
          industryOptions={mockIndustries}
        />
      </div>
    </Form>
  );
};

const meta: Meta<typeof PersonalInfo> = {
  title: 'Onboarding/Steps/PersonalInfo',
  component: PersonalInfo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PersonalInfo>;

export const Empty: Story = {
  render: () => <PersonalInfoFormWrapper />,
};

export const Filled: Story = {
  render: () => (
    <PersonalInfoFormWrapper
      initialValues={{
        location: 'TWN',
        years_of_experience: '3~5 年',
        industry: 'software_engineering',
      }}
    />
  ),
};

export const ValidationError: Story = {
  render: () => (
    <PersonalInfoFormWrapper
      initialValues={{
        location: '',
        years_of_experience: '',
        industry: '',
      }}
      triggerValidation={true}
    />
  ),
};

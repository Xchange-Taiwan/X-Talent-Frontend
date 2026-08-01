import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

import { JobExperienceSection } from './JobExperienceSection';
import { ProfileStoryWrapper } from './ProfileStoryWrapper';

const locationsMock = [
  { value: 'TWN', text: '臺灣 (Taiwan)' },
  { value: 'USA', text: '美國 (United States)' },
  { value: 'JPN', text: '日本 (Japan)' },
];

const industriesMock = [
  { subject: '軟體開發 / 網際網路', subject_group: 'Software' },
  { subject: '金融 / 銀行', subject_group: 'Finance' },
  { subject: '設計 / 藝術', subject_group: 'Design' },
  { subject: '教育 / 研究', subject_group: 'Education' },
];

const meta: Meta<typeof JobExperienceSection> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/JobExperienceSection',
  component: JobExperienceSection,
  tags: ['autodocs'],
  args: {
    industries: industriesMock,
    locations: locationsMock,
    isMentor: false,
    onValidationChange: (hasError) =>
      console.log('Validation change:', hasError),
  },
};

export default meta;

type Story = StoryObj<typeof JobExperienceSection>;

const SectionWithForm = (props: {
  isMentor: boolean;
  initialExperiences?: ProfileFormValues['work_experiences'];
  onValidationChange: (hasError: boolean) => void;
}) => {
  const schema = createProfileFormSchema(props.isMentor);

  return (
    <ProfileStoryWrapper
      schema={schema}
      defaultValues={{
        ...defaultValues,
        is_mentor: props.isMentor,
        work_experiences: props.initialExperiences ?? [],
      }}
    >
      {(form) => (
        <JobExperienceSection
          industries={industriesMock}
          locations={locationsMock}
          form={form}
          isMentor={props.isMentor}
          onValidationChange={props.onValidationChange}
        />
      )}
    </ProfileStoryWrapper>
  );
};

export const Empty: Story = {
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      initialExperiences={[]}
      onValidationChange={args.onValidationChange}
    />
  ),
};

export const Filled: Story = {
  args: {
    isMentor: true,
  },
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      initialExperiences={[
        {
          id: 1,
          job: '資深前端工程師 (Senior Frontend Engineer)',
          company: '科技股份有限公司 (Tech Co., Ltd.)',
          job_period_start: '2023',
          job_period_end: 'now',
          industry: 'Software',
          job_location: 'TWN',
          description:
            '負責開發與維護公司核心 React/Next.js 前端應用，並主導團隊前端架構優化與測試覆蓋。',
          is_primary: true,
        },
      ]}
      onValidationChange={args.onValidationChange}
    />
  ),
};

export const MultipleEntries: Story = {
  args: {
    isMentor: true,
  },
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      initialExperiences={[
        {
          id: 1,
          job: '資深前端工程師 (Senior Frontend Engineer)',
          company: '創新科技股份有限公司',
          job_period_start: '2024',
          job_period_end: 'now',
          industry: 'Software',
          job_location: 'TWN',
          description: '負責設計高併發 React Dashboard 架構。',
          is_primary: true,
        },
        {
          id: 2,
          job: '前端工程師 (Frontend Engineer)',
          company: '優質軟體有限公司',
          job_period_start: '2021',
          job_period_end: '2024',
          industry: 'Software',
          job_location: 'TWN',
          description: '負責重構舊有系統，將效能提升了 40%。',
          is_primary: false,
        },
      ]}
      onValidationChange={args.onValidationChange}
    />
  ),
};

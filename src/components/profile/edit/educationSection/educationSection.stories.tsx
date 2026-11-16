import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useEffect } from 'react';

import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

import { ProfileStoryWrapper } from '../ProfileStoryWrapper';
import { EducationSection } from './educationSection';

const meta: Meta<typeof EducationSection> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/EducationSection',
  component: EducationSection,
  tags: ['autodocs'],
  args: {
    isMentor: false,
  },
};

export default meta;

type Story = StoryObj<typeof EducationSection>;

function EducationSectionBody({
  form,
  isMentor,
  triggerOnMount = false,
}: {
  form: ProfileFormContext;
  isMentor: boolean;
  triggerOnMount?: boolean;
}) {
  useEffect(() => {
    if (triggerOnMount) {
      void form.trigger('educations');
    }
  }, [form, triggerOnMount]);

  return <EducationSection form={form} isMentor={isMentor} />;
}

const SectionWithForm = (props: {
  isMentor: boolean;
  initialEducations?: ProfileFormValues['educations'];
  triggerOnMount?: boolean;
}) => {
  const schema = createProfileFormSchema(props.isMentor);

  return (
    <ProfileStoryWrapper
      schema={schema}
      defaultValues={{
        ...defaultValues,
        is_mentor: props.isMentor,
        educations: props.initialEducations ?? [],
      }}
    >
      {(form) => (
        <EducationSectionBody
          form={form}
          isMentor={props.isMentor}
          triggerOnMount={props.triggerOnMount}
        />
      )}
    </ProfileStoryWrapper>
  );
};

export const Empty: Story = {
  render: (args) => (
    <SectionWithForm isMentor={args.isMentor} initialEducations={[]} />
  ),
};

export const Filled: Story = {
  args: {
    isMentor: true,
  },
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      initialEducations={[
        {
          id: 1,
          subject: '資訊工程學系 (Computer Science & Engineering)',
          school: '國立臺灣大學',
          education_period_start: '2019',
          education_period_end: '2023',
        },
      ]}
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
      initialEducations={[
        {
          id: 1,
          subject:
            '網際網路與多媒體研究所 (Institute of Networking and Multimedia)',
          school: '國立臺灣大學',
          education_period_start: '2023',
          education_period_end: 'now',
        },
        {
          id: 2,
          subject: '資訊工程學系 (Computer Science & Engineering)',
          school: '國立臺灣大學',
          education_period_start: '2019',
          education_period_end: '2023',
        },
      ]}
    />
  ),
};

export const InvalidPeriod: Story = {
  name: '起訖年份順序錯誤狀態',
  args: {
    isMentor: true,
  },
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      triggerOnMount
      initialEducations={[
        {
          id: 1,
          subject: '資訊工程學系 (Computer Science & Engineering)',
          school: '國立臺灣大學',
          education_period_start: '2025',
          education_period_end: '2021',
        },
      ]}
    />
  ),
};

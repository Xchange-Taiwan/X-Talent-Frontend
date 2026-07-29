import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import {
  createProfileFormSchema,
  defaultValues,
  ProfileFormValues,
} from '@/schemas/profileSchema';

import { EducationSection } from './educationSection';

const meta: Meta<typeof EducationSection> = {
  title: 'Components/Profile/Edit/EducationSection',
  component: EducationSection,
  tags: ['autodocs'],
  args: {
    isMentor: false,
    onValidationChange: (hasError) =>
      console.log('Validation change:', hasError),
  },
};

export default meta;

type Story = StoryObj<typeof EducationSection>;

const SectionWithForm = (props: {
  isMentor: boolean;
  initialEducations?: ProfileFormValues['educations'];
  onValidationChange: (hasError: boolean) => void;
}) => {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(props.isMentor)),
    defaultValues: {
      ...defaultValues,
      is_mentor: props.isMentor,
      educations: props.initialEducations ?? [],
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => console.log('Submit:', data))}
        className="max-w-3xl space-y-6 rounded-xl border border-background-border bg-background-white p-6 shadow-sm"
      >
        <EducationSection
          form={form}
          isMentor={props.isMentor}
          onValidationChange={props.onValidationChange}
        />
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-text-white transition-colors hover:bg-brand-600"
        >
          提交表單
        </button>
      </form>
    </Form>
  );
};

export const Empty: Story = {
  render: (args) => (
    <SectionWithForm
      isMentor={args.isMentor}
      initialEducations={[]}
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
      initialEducations={[
        {
          id: 1,
          subject: '資訊工程學系 (Computer Science & Engineering)',
          school: '國立臺灣大學',
          education_period_start: '2019',
          education_period_end: '2023',
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
      onValidationChange={args.onValidationChange}
    />
  ),
};

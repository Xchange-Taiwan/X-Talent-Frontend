'use client';
import React from 'react';

import Divider from '@/components/auth/Divider';
import {
  EducationExperienceMetadata,
  WorkExperienceMetadata,
} from '@/hooks/user/user-data/useUserData';

export type ExperienceItem = {
  title: string;
  subtitle: string;
  description?: string;
  startDate: string;
  endDate: string;
};

export const ExperienceItemCard = ({
  title,
  subtitle,
  description,
  startDate,
  endDate,
}: ExperienceItem) => {
  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex justify-between gap-2 text-sm text-gray-600">
        <span className="min-w-0 break-words">{subtitle}</span>
        <span className="shrink-0 text-xs">
          {startDate} - {endDate}
        </span>
      </div>
      <div>
        <h2
          className="mb-1 break-words text-base font-bold"
          style={{ color: '#49454F' }}
        >
          {title}
        </h2>
        {description && (
          <p className="break-words text-sm" style={{ color: '#49454F' }}>
            {description}
          </p>
        )}
      </div>
    </section>
  );
};

export type ExperienceSectionProps = {
  items: ExperienceItem[];
};

export const ExperienceSection = ({ items }: ExperienceSectionProps) => {
  return (
    <section className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <div key={idx}>
          <ExperienceItemCard {...item} />
          {idx < items.length - 1 && <Divider />}
        </div>
      ))}
    </section>
  );
};

export type WorkExperienceSectionProps = {
  workExperiences?: WorkExperienceMetadata[];
};

export const WorkExperienceSection = ({
  workExperiences,
}: WorkExperienceSectionProps) => {
  const workExperienceItems: ExperienceItem[] = (workExperiences ?? []).map(
    (experience) => ({
      title: experience.job ?? '',
      subtitle: experience.company ?? '',
      description: experience.description ?? '',
      startDate: experience.job_period_start ?? '',
      endDate: experience.job_period_end ?? '',
    })
  );

  return <ExperienceSection items={workExperienceItems} />;
};

export type EducationSectionProps = {
  educations?: EducationExperienceMetadata[];
};

export const EducationSection = ({ educations }: EducationSectionProps) => {
  const educationItems: ExperienceItem[] = (educations ?? []).map(
    (education) => ({
      title: education.subject ?? '',
      subtitle: education.school ?? '',
      startDate: education.education_period_start ?? '',
      endDate: education.education_period_end ?? '',
    })
  );

  return <ExperienceSection items={educationItems} />;
};

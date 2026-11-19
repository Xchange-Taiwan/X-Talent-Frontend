'use client';
import { Briefcase, GraduationCap } from 'lucide-react';
import React from 'react';

import Divider from '@/components/auth/Divider';
import { resolveLocationLabel } from '@/lib/mentor/mentorStats';
import {
  EducationExperienceMetadata,
  WorkExperienceMetadata,
} from '@/lib/profile/experienceCodec';

type ExperienceItem = {
  title: string;
  subtitle: string;
  description?: string;
  startDate: string;
  endDate: string;
  icon?: React.ReactNode;
};

function formatDisplayEndYear(raw: string): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'now') {
    return '至今';
  }
  return trimmed;
}

const ExperienceItemCard = ({
  title,
  subtitle,
  description,
  startDate,
  endDate,
  icon,
}: ExperienceItem) => {
  const formattedEnd = formatDisplayEndYear(endDate);
  const periodText =
    startDate && formattedEnd
      ? `${startDate} — ${formattedEnd}`
      : startDate || formattedEnd;

  return (
    <article className="mb-6 flex items-start gap-3.5">
      {icon && (
        <span
          aria-hidden="true"
          className="bg-background-bottom-secondary text-text-secondary mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-text-primary text-base font-semibold break-words">
          {title}
        </h3>
        {subtitle && (
          <p className="text-text-secondary mt-0.5 text-sm break-words">
            {subtitle}
          </p>
        )}
        {periodText && (
          <p className="text-text-tertiary mt-1 text-xs tabular-nums">
            {periodText}
          </p>
        )}
        {description && (
          <p className="text-text-secondary mt-2.5 text-sm leading-relaxed break-words whitespace-pre-line">
            {description}
          </p>
        )}
      </div>
    </article>
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
  industries?: ReadonlyArray<{ subject_group: string; subject: string }>;
  industryLabelByCode?: ReadonlyMap<string, string>;
};

export const WorkExperienceSection = ({
  workExperiences,
  industries,
  industryLabelByCode,
}: WorkExperienceSectionProps) => {
  const resolvedIndustryMap = React.useMemo(() => {
    if (industryLabelByCode) return industryLabelByCode;
    if (!industries?.length) return undefined;
    return new Map(
      industries.map((item) => [item.subject_group, item.subject])
    );
  }, [industries, industryLabelByCode]);

  const workExperienceItems: ExperienceItem[] = (workExperiences ?? []).map(
    (experience) => {
      const locLabel = experience.job_location
        ? resolveLocationLabel(experience.job_location, 'zh_TW')
        : '';
      const rawIndustry = experience.industry?.trim() ?? '';
      const industryLabel = rawIndustry
        ? (resolvedIndustryMap?.get(rawIndustry) ?? rawIndustry)
        : '';
      const metaParts = [experience.company, locLabel, industryLabel]
        .map((s) => s?.trim())
        .filter(Boolean);

      return {
        title: experience.job ?? '',
        subtitle: metaParts.join(' · '),
        description: experience.description ?? '',
        startDate: experience.job_period_start ?? '',
        endDate: experience.job_period_end ?? '',
        icon: <Briefcase className="size-5" />,
      };
    }
  );

  return <ExperienceSection items={workExperienceItems} />;
};

export type EducationSectionProps = {
  educations?: EducationExperienceMetadata[];
};

export const EducationSection = ({ educations }: EducationSectionProps) => {
  const educationItems: ExperienceItem[] = (educations ?? []).map(
    (education) => ({
      title: education.school ?? '',
      subtitle: education.subject ?? '',
      startDate: education.education_period_start ?? '',
      endDate: education.education_period_end ?? '',
      icon: <GraduationCap className="size-5" />,
    })
  );

  return <ExperienceSection items={educationItems} />;
};

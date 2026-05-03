import * as z from 'zod';

import {
  educationSchema,
  jobSchema,
  personLinkSchema,
} from '@/components/profile/edit/profileSchema';
import { MentorExperiencePayload } from '@/services/profile/upsertExperience';

type PersonalLinkFormValue = z.infer<typeof personLinkSchema>;
type WorkExperienceFormValue = z.infer<typeof jobSchema>;
type EducationFormValue = z.infer<typeof educationSchema>;

type MentorExperienceMetadata<T> = { data?: T[] };

export function parseLinks(
  experiences: MentorExperiencePayload[]
): Partial<
  Record<
    'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'website',
    PersonalLinkFormValue
  >
> {
  const result: Partial<
    Record<
      'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'website',
      PersonalLinkFormValue
    >
  > = {};

  experiences
    ?.filter((e) => e.category === 'LINK')
    .forEach((e) => {
      const metadata =
        e.mentor_experiences_metadata as MentorExperienceMetadata<PersonalLinkFormValue>;
      const entries = metadata?.data || [];

      entries.forEach((entry) => {
        const platform = entry.platform as keyof typeof result;
        const url = entry.url || '';
        const id = e.id ?? -1;

        if (
          platform &&
          [
            'linkedin',
            'facebook',
            'instagram',
            'twitter',
            'youtube',
            'website',
          ].includes(platform)
        ) {
          result[platform] = { id, platform, url };
        }
      });
    });

  return result;
}

export function parseWorkExperiences(
  experiences: MentorExperiencePayload[]
): WorkExperienceFormValue[] {
  const flattened = (experiences ?? [])
    .filter((e) => e.category === 'WORK')
    .flatMap((e) => {
      const metadata =
        e.mentor_experiences_metadata as MentorExperienceMetadata<WorkExperienceFormValue>;
      const entries = metadata?.data || [];
      return entries.map((item) => ({
        id: typeof e.id === 'number' ? e.id : -1,
        job: item.job || '',
        company: item.company || '',
        jobPeriodStart: item.jobPeriodStart || '',
        jobPeriodEnd: item.jobPeriodEnd || '',
        industry: item.industry || '',
        jobLocation: item.jobLocation || '',
        description: item.description || '',
        isPrimary: item.isPrimary ?? false,
      }));
    });

  if (flattened.length > 0 && !flattened.some((item) => item.isPrimary)) {
    flattened[0].isPrimary = true;
  }

  return flattened;
}

export function parseEducations(
  experiences: MentorExperiencePayload[]
): EducationFormValue[] {
  return (experiences ?? [])
    .filter((e) => e.category === 'EDUCATION')
    .flatMap((e) => {
      const metadata =
        e.mentor_experiences_metadata as MentorExperienceMetadata<EducationFormValue>;
      const entries = metadata?.data || [];
      return entries.map((item) => ({
        id: typeof e.id === 'number' ? e.id : -1,
        subject: item.subject || '',
        school: item.school || '',
        educationPeriodStart: item.educationPeriodStart || '',
        educationPeriodEnd: item.educationPeriodEnd || '',
      }));
    });
}

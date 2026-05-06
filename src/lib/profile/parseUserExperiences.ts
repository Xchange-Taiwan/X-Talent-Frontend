import * as z from 'zod';

import {
  educationSchema,
  jobSchema,
  personLinkSchema,
} from '@/components/profile/edit/profileSchema';
import { ExperienceType } from '@/services/profile/experienceType';

type PersonalLinkFormValue = z.infer<typeof personLinkSchema>;
type WorkExperienceFormValue = z.infer<typeof jobSchema>;
type EducationFormValue = z.infer<typeof educationSchema>;

// Wire shape for experiences. Mirrors the inline batch on
// MentorProfileVO/DTO: backend stores them as JSONB[] on profiles.experiences.
// No row id — each category packs its items in metadata.data, and RHF gets
// a stable per-form-item id from the array index when we hydrate the form.
export interface MentorExperiencePayload {
  category: ExperienceType | string;
  mentor_experiences_metadata: Record<string, unknown>;
  order: number;
}

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

      entries.forEach((entry, idx) => {
        const platform = entry.platform as keyof typeof result;
        const url = entry.url || '';
        // RHF only needs a stable numeric id for the form item; array index
        // suffices now that experiences no longer carry a DB row id.
        const id = idx;

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
      return entries.map((item, idx) => ({
        id: idx,
        job: item.job || '',
        company: item.company || '',
        job_period_start: item.job_period_start || '',
        job_period_end: item.job_period_end || '',
        industry: item.industry || '',
        job_location: item.job_location || '',
        description: item.description || '',
        is_primary: item.is_primary ?? false,
      }));
    });

  if (flattened.length > 0 && !flattened.some((item) => item.is_primary)) {
    flattened[0].is_primary = true;
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
      return entries.map((item, idx) => ({
        id: idx,
        subject: item.subject || '',
        school: item.school || '',
        education_period_start: item.education_period_start || '',
        education_period_end: item.education_period_end || '',
      }));
    });
}

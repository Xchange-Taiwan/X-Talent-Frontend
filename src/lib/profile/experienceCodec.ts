import { isSafeUrl } from '@/lib/url/isSafeUrl';
import { ExperienceType } from '@/services/profile/experienceType';

// Wire shape for experiences. Mirrors the inline batch on
// MentorProfileVO/DTO: backend stores them as JSONB[] on profiles.experiences.
// No row id — each category packs its items in metadata.data.
export interface MentorExperiencePayload {
  category: ExperienceType | string;
  mentor_experiences_metadata: Record<string, unknown>;
  order: number;
}

// Fields are guaranteed present (never undefined) on decode()'s output —
// decode() fills every field with a safe default, so callers can consume
// the result directly without re-declaring fallback logic of their own.
export interface WorkExperienceMetadata {
  job: string;
  company: string;
  job_period_start: string;
  job_period_end: string;
  job_location: string;
  description: string;
  industry: string;
  is_primary: boolean;
}

export interface EducationExperienceMetadata {
  subject: string;
  school: string;
  education_period_start: string;
  education_period_end: string;
}

export interface PersonalLinkMetadata {
  platform: string;
  url: string;
}

export interface DecodedExperiences {
  workExperiences: WorkExperienceMetadata[];
  educations: EducationExperienceMetadata[];
  personalLinks: PersonalLinkMetadata[];
}

// encode() tolerates partial per-item data (legacy rows, in-progress edits)
// and fills the same wire defaults decode() does on the way back — so its
// input is intentionally looser than decode()'s guaranteed output shape.
export interface EncodeInput {
  workExperiences: Partial<WorkExperienceMetadata>[];
  educations: Partial<EducationExperienceMetadata>[];
  personalLinks: PersonalLinkMetadata[];
}

export interface EncodeResult {
  experiences: MentorExperiencePayload[];
  job_title: string;
  company: string;
}

type MentorExperienceMetadataBlock<T> = { data?: T[] };

function getMetadataArray<T>(
  experiences: MentorExperiencePayload[] | undefined,
  category: ExperienceType
): T[] {
  return (experiences ?? [])
    .filter((e) => e.category === category)
    .flatMap((e) => {
      const metadata =
        e.mentor_experiences_metadata as MentorExperienceMetadataBlock<T>;
      return metadata?.data ?? [];
    });
}

export function decode(
  experiences: MentorExperiencePayload[] | undefined
): DecodedExperiences {
  const workExperiences = getMetadataArray<Partial<WorkExperienceMetadata>>(
    experiences,
    ExperienceType.WORK
  ).map((item) => ({
    job: item.job || '',
    company: item.company || '',
    job_period_start: item.job_period_start || '',
    job_period_end: item.job_period_end || '',
    industry: item.industry || '',
    job_location: item.job_location || '',
    description: item.description || '',
    is_primary: item.is_primary ?? false,
  }));

  // Self-healing invariant: legacy data with no work experience flagged
  // primary falls back to the first entry, matching the JobExperienceSection
  // UI. Only kicks in when nothing is already marked primary.
  if (
    workExperiences.length > 0 &&
    !workExperiences.some((w) => w.is_primary)
  ) {
    workExperiences[0].is_primary = true;
  }

  const educations = getMetadataArray<Partial<EducationExperienceMetadata>>(
    experiences,
    ExperienceType.EDUCATION
  ).map((item) => ({
    subject: item.subject || '',
    school: item.school || '',
    education_period_start: item.education_period_start || '',
    education_period_end: item.education_period_end || '',
  }));

  // isSafeUrl blocks javascript:/data:/etc. Applied here (not per-caller) so
  // both the display path and the RHF edit form get the same protection —
  // profiles can be written directly via BFF calls, bypassing the form's own
  // URL validation.
  const personalLinks = getMetadataArray<PersonalLinkMetadata>(
    experiences,
    ExperienceType.LINK
  )
    .map((item) => ({ platform: item.platform, url: item.url || '' }))
    .filter((link) => isSafeUrl(link.url));

  return { workExperiences, educations, personalLinks };
}

export function encode({
  workExperiences,
  educations,
  personalLinks,
}: EncodeInput): EncodeResult {
  // Mentor's top-level job_title / company mirror the primary work
  // experience so consumers (profile page, mentor pool card, reservations)
  // can read them directly without re-deriving from the experience list.
  // Falls back to the first entry when none is flagged primary; empty
  // strings (not undefined) when there are no work experiences at all, so
  // the backend clears stale values rather than leaving them untouched.
  const primaryWork =
    workExperiences.find((w) => w.is_primary) ?? workExperiences[0];
  const job_title = primaryWork?.job ?? '';
  const company = primaryWork?.company ?? '';

  const experiences: MentorExperiencePayload[] = [
    {
      category: ExperienceType.WORK,
      order: 1,
      mentor_experiences_metadata: {
        data: workExperiences.map((item) => ({
          job: item.job,
          company: item.company,
          job_period_start: item.job_period_start,
          job_period_end: item.job_period_end,
          industry: item.industry,
          job_location: item.job_location,
          description: item.description,
          is_primary: item.is_primary ?? false,
        })),
      },
    },
    {
      category: ExperienceType.EDUCATION,
      order: 2,
      mentor_experiences_metadata: {
        data: educations.map((item) => ({
          school: item.school,
          subject: item.subject,
          education_period_start: item.education_period_start,
          education_period_end: item.education_period_end,
        })),
      },
    },
    {
      category: ExperienceType.LINK,
      order: 3,
      mentor_experiences_metadata: {
        data: personalLinks.map((link) => ({
          platform: link.platform,
          url: link.url,
        })),
      },
    },
  ];

  return { experiences, job_title, company };
}

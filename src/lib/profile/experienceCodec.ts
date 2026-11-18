import {
  createEmptySocialLinks,
  isSocialPlatformKey,
  type PersonalLink,
  type SocialPlatformKey,
  validatePlatformUrl,
} from '@/lib/profile/socialLinks';
import { isSafeUrl } from '@/lib/url/isSafeUrl';
import { ExperienceType } from '@/services/profile/experienceType';
import type { components } from '@/types/api';

type WireExperienceVO = components['schemas']['ExperienceVO'];

export type { PersonalLink };

// Wire shape for experiences. Mirrors the inline batch on
// MentorProfileVO/DTO: backend stores them as JSONB[] on profiles.experiences
// where each element wraps its items under `mentor_experiences_metadata.data`.
export interface MentorExperiencePayload {
  id?: number;
  category: string;
  mentor_experiences_metadata: Record<string, unknown>;
  order: number;
}

export interface WorkExperienceMetadata {
  job: string;
  company: string;
  job_period_start: string;
  job_period_end: string;
  industry: string;
  job_location: string;
  description: string;
  is_primary: boolean;
}

export interface EducationExperienceMetadata {
  subject: string;
  school: string;
  education_period_start: string;
  education_period_end: string;
}

export type PersonalLinkMetadata = PersonalLink;

export interface DecodedExperiences {
  workExperiences: WorkExperienceMetadata[];
  educations: EducationExperienceMetadata[];
  personalLinks: PersonalLinkMetadata[];
}

export interface WorkExperienceFormValue extends WorkExperienceMetadata {
  id: number;
}

export interface EducationFormValue extends EducationExperienceMetadata {
  id: number;
}

export interface ExperienceFormValues {
  workExperiences: WorkExperienceFormValue[];
  educations: EducationFormValue[];
  links: Record<SocialPlatformKey, string>;
}

// Encode accepts form-shaped work/education items directly: RHF's extra `id`
// is stripped when mapping to metadata, and missing optional fields default
// cleanly so callers don't have to pre-sanitize.
export interface EncodeInput {
  workExperiences: Array<
    Partial<WorkExperienceMetadata> & { job: string; company: string }
  >;
  educations: Array<Partial<EducationExperienceMetadata>>;
  personalLinks: PersonalLinkMetadata[];
}

export interface EncodeResult {
  experiences: MentorExperiencePayload[];
  job_title: string;
  company: string;
}

function getMetadataArray<T>(
  experiences: MentorExperiencePayload[] | undefined,
  category: ExperienceType
): T[] {
  if (!experiences) return [];
  return experiences
    .filter((exp) => exp.category === category)
    .flatMap((exp) => {
      const rawData = exp.mentor_experiences_metadata?.data;
      return Array.isArray(rawData) ? (rawData as T[]) : [];
    });
}

export interface DecodeExperiencesOptions {
  preservePlatformCase?: boolean;
}

/**
 * Single decoder from wire `MentorExperiencePayload[]` into domain arrays.
 *
 * Encapsulates every read-side invariant in one place:
 * - Work experiences with no `is_primary` flag default the first entry to
 *   primary (legacy records predate the flag).
 * - Personal link platforms normalize to canonical lowercase `SocialPlatformKey`
 *   by default (`preservePlatformCase` is reserved for BFF auth user payloads).
 * - Personal link URLs pass `isSafeUrl` so `javascript:` / `data:` schemes
 *   stored in the DB never reach an `<a href>`.
 * - Missing fields fall back to empty strings so UI/form consumers never see
 *   `undefined`.
 */
export function decode(
  experiences: MentorExperiencePayload[] | undefined,
  options?: DecodeExperiencesOptions
): DecodedExperiences {
  const rawWork = getMetadataArray<Partial<WorkExperienceMetadata> | null>(
    experiences,
    ExperienceType.WORK
  ).filter((item): item is Partial<WorkExperienceMetadata> =>
    Boolean(item && typeof item === 'object')
  );

  const workExperiences: WorkExperienceMetadata[] = rawWork.map((item) => ({
    job: item.job || '',
    company: item.company || '',
    job_period_start: item.job_period_start || '',
    job_period_end: item.job_period_end || '',
    industry: item.industry || '',
    job_location: item.job_location || '',
    description: item.description || '',
    is_primary: item.is_primary ?? false,
  }));

  if (
    workExperiences.length > 0 &&
    !workExperiences.some((w) => w.is_primary)
  ) {
    workExperiences[0].is_primary = true;
  }

  const educations: EducationExperienceMetadata[] =
    getMetadataArray<Partial<EducationExperienceMetadata> | null>(
      experiences,
      ExperienceType.EDUCATION
    )
      .filter((item): item is Partial<EducationExperienceMetadata> =>
        Boolean(item && typeof item === 'object')
      )
      .map((item) => ({
        subject: item.subject || '',
        school: item.school || '',
        education_period_start: item.education_period_start || '',
        education_period_end: item.education_period_end || '',
      }));

  const personalLinks: PersonalLinkMetadata[] =
    getMetadataArray<Partial<PersonalLinkMetadata> | null>(
      experiences,
      ExperienceType.LINK
    )
      .filter((item): item is Partial<PersonalLinkMetadata> =>
        Boolean(item && typeof item === 'object')
      )
      .map((item) => {
        const rawPlatform =
          typeof item.platform === 'string' ? item.platform.trim() : '';
        const normalizedPlatform = rawPlatform.toLowerCase();
        const platform = options?.preservePlatformCase
          ? rawPlatform
          : normalizedPlatform;
        const rawUrl = typeof item.url === 'string' ? item.url.trim() : '';
        if (
          !isSafeUrl(rawUrl) &&
          rawUrl &&
          isSocialPlatformKey(normalizedPlatform)
        ) {
          const validation = validatePlatformUrl(normalizedPlatform, rawUrl);
          if (validation.valid && validation.normalizedUrl) {
            return { platform, url: validation.normalizedUrl };
          }
        }
        return { platform, url: rawUrl };
      })
      .filter((link) => Boolean(link.platform) && isSafeUrl(link.url));

  return { workExperiences, educations, personalLinks };
}

/**
 * Adapts decoded domain experiences into React Hook Form input values:
 * - Injects synthetic `id` (array index) on repeatable rows for `useFieldArray`.
 * - Maps flat `personalLinks` into `Record<SocialPlatformKey, string>` with
 *   platform domain validation and last-writer-wins semantics.
 */
export function toFormValues(
  experiences: MentorExperiencePayload[] | undefined
): ExperienceFormValues {
  const { workExperiences, educations, personalLinks } = decode(experiences);

  const links = createEmptySocialLinks();
  for (const link of personalLinks) {
    if (isSocialPlatformKey(link.platform)) {
      const validation = validatePlatformUrl(link.platform, link.url);
      if (validation.valid && validation.normalizedUrl) {
        links[link.platform] = validation.normalizedUrl;
      }
    }
  }

  return {
    workExperiences: workExperiences.map((item, idx) => ({ id: idx, ...item })),
    educations: educations.map((item, idx) => ({ id: idx, ...item })),
    links,
  };
}

/**
 * Symmetric encoder: builds the three-category `experiences` batch for
 * `PUT /v1/mentors/{id}/profile` and derives the canonical `job_title` /
 * `company` mirrored onto the top-level profile record from the primary work
 * experience (falling back to the first entry when none is marked primary, or
 * empty strings when workExperiences is empty).
 */
export function encode(input: EncodeInput): EncodeResult {
  const { workExperiences, educations, personalLinks } = input;

  const primary =
    workExperiences.find((w) => w.is_primary) ?? workExperiences[0];
  const job_title = primary?.job ?? '';
  const company = primary?.company ?? '';

  const experiences: MentorExperiencePayload[] = [
    {
      category: ExperienceType.WORK,
      order: 1,
      mentor_experiences_metadata: {
        data: workExperiences.map((item) => ({
          job: item.job,
          company: item.company,
          job_period_start: item.job_period_start ?? '',
          job_period_end: item.job_period_end ?? '',
          industry: item.industry ?? '',
          job_location: item.job_location ?? '',
          description: item.description ?? '',
          is_primary: item.is_primary ?? false,
        })),
      },
    },
    {
      category: ExperienceType.EDUCATION,
      order: 2,
      mentor_experiences_metadata: {
        data: educations.map((edu) => ({
          subject: edu.subject ?? '',
          school: edu.school ?? '',
          education_period_start: edu.education_period_start ?? '',
          education_period_end: edu.education_period_end ?? '',
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

export interface WireExperienceLike {
  category?: string | null;
  mentor_experiences_metadata?: unknown;
  order?: number | null;
}

/**
 * Normalizes OpenAPI `ExperienceVO[]` or BFF `MentorExperience[]` into
 * `MentorExperiencePayload[]` at the codec boundary.
 */
export function fromWireExperiences(
  experiences:
    | readonly WireExperienceVO[]
    | readonly MentorExperiencePayload[]
    | readonly WireExperienceLike[]
    | null
    | undefined
): MentorExperiencePayload[] | undefined {
  if (!experiences) return undefined;
  return experiences as unknown as MentorExperiencePayload[];
}

/**
 * Projects `MentorExperiencePayload[]` back onto OpenAPI `ExperienceVO[] | null`
 * for optimistic `MentorProfileVO` construction without leaking casts to callers.
 */
export function toWireExperiences(
  experiences: readonly MentorExperiencePayload[] | null | undefined
): WireExperienceVO[] | null {
  if (!experiences) return null;
  return experiences as unknown as WireExperienceVO[];
}

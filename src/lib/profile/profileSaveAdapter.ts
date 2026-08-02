import { encode } from '@/lib/profile/experienceCodec';
import {
  MentorExperiencePayload,
  toFormValues,
} from '@/lib/profile/parseUserExperiences';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';
import type { MentorProfileVO } from '@/types/user';

export type ProfileDirtyFields = Partial<
  Record<keyof ProfileFormValues, unknown>
>;

/**
 * Checks if a partial/nested value in React Hook Form's dirtyFields is actually dirty.
 */
export function hasDirtyValue(v: unknown): boolean {
  if (!v) return false;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.some(hasDirtyValue);
  if (typeof v === 'object') return Object.values(v).some(hasDirtyValue);
  return Boolean(v);
}

/**
 * Maps MentorProfileVO (from API) into ProfileFormValues (for React Hook Form).
 */
export function mapVoToFormValues(
  userDto: MentorProfileVO,
  isMentorOnboarding: boolean
): ProfileFormValues {
  const mentorFlag = Boolean(userDto.is_mentor || isMentorOnboarding);
  const experiences =
    userDto.experiences as unknown as MentorExperiencePayload[];

  const {
    workExperiences: parsedExperiences,
    educations: parsedEducations,
    links: parsedLinks,
  } = toFormValues(experiences);

  const industryTag = readIndustryTag(userDto.industry);
  const industrySg = industryTag?.subject_group ?? '';

  return {
    is_mentor: mentorFlag,
    avatar: userDto.avatar || '',
    avatarFile: undefined,
    name: userDto.name || '',
    location: userDto.location || '',
    statement: userDto.personal_statement || '',
    about: userDto.about || '',
    industry: industrySg,
    years_of_experience: userDto.years_of_experience || '',
    work_experiences: parsedExperiences || defaultValues.work_experiences,
    educations: parsedEducations || defaultValues.educations,
    linkedin: parsedLinks.linkedin || defaultValues.linkedin,
    facebook: parsedLinks.facebook || defaultValues.facebook,
    instagram: parsedLinks.instagram || defaultValues.instagram,
    twitter: parsedLinks.twitter || defaultValues.twitter,
    youtube: parsedLinks.youtube || defaultValues.youtube,
    website: parsedLinks.website || defaultValues.website,
    have_topic: userDto.have_topic ?? [],
    have_skill: userDto.have_skill ?? [],
    want_position: userDto.want_position ?? [],
    want_skill: userDto.want_skill ?? [],
    want_topic: userDto.want_topic ?? [],
  };
}

/**
 * Computes dirty states for profile fields based on React Hook Form's dirtyFields.
 */
export function computeDirtyStates(
  values: ProfileFormValues,
  dirtyFields: ProfileDirtyFields | undefined,
  isMentorOnboarding: boolean
): { experiencesDirty: boolean; profileDirty: boolean } {
  const isDirty = (key: keyof ProfileFormValues): boolean => {
    if (!dirtyFields) return true;
    return hasDirtyValue(dirtyFields[key]);
  };

  const workDirty = isDirty('work_experiences');
  const educationDirty = isDirty('educations');
  const linksDirty =
    isDirty('linkedin') ||
    isDirty('facebook') ||
    isDirty('instagram') ||
    isDirty('twitter') ||
    isDirty('youtube') ||
    isDirty('website');
  const experiencesDirty = workDirty || educationDirty || linksDirty;

  const profileDirty =
    isMentorOnboarding ||
    Boolean(values.avatarFile) ||
    isDirty('avatar') ||
    isDirty('name') ||
    isDirty('about') ||
    isDirty('location') ||
    isDirty('industry') ||
    isDirty('years_of_experience') ||
    isDirty('statement') ||
    isDirty('have_skill') ||
    isDirty('have_topic') ||
    isDirty('want_position') ||
    isDirty('want_skill') ||
    isDirty('want_topic') ||
    experiencesDirty;

  return { experiencesDirty, profileDirty };
}

/**
 * Filters and extracts the valid personal links that have a non-empty URL.
 */
export function extractValidLinks(values: ProfileFormValues) {
  return [
    values.linkedin,
    values.facebook,
    values.instagram,
    values.twitter,
    values.youtube,
    values.website,
  ].filter((l) => l && l.url);
}

/**
 * Maps ProfileFormValues into the payload needed for the updateProfile API.
 */
export function mapFormValuesToPayload(
  values: ProfileFormValues,
  avatar: string | undefined,
  experiencesDirty: boolean
) {
  const links = extractValidLinks(values);

  const {
    experiences,
    job_title,
    company: companyFromPrimary,
  } = encode({
    workExperiences: values.work_experiences ?? [],
    educations: values.educations ?? [],
    personalLinks: links,
  });

  return {
    ...values,
    avatar,
    avatarFile: undefined,
    job_title,
    company: companyFromPrimary,
    // Three-state semantic on the wire: omit when no experience section
    // changed (backend leaves the column alone); include the full set
    // when any section is dirty (backend overwrites). Replace semantics:
    // backend overwrites profiles.experiences wholesale with this batch.
    ...(experiencesDirty ? { experiences } : {}),
  };
}

/**
 * Verifies if the latest MentorProfileVO fetched from the backend matches the submitted form values.
 */
export function isProfileSynced(
  values: ProfileFormValues,
  latest: MentorProfileVO,
  avatar: string
): boolean {
  if (latest.name !== values.name) return false;
  if ((latest.location ?? '') !== (values.location ?? '')) return false;
  if ((latest.personal_statement ?? '') !== (values.statement ?? ''))
    return false;
  if ((latest.about ?? '') !== (values.about ?? '')) return false;
  if ((latest.years_of_experience ?? '') !== (values.years_of_experience ?? ''))
    return false;
  if (
    (readIndustryTag(latest.industry)?.subject_group ?? '') !==
    (values.industry ?? '')
  )
    return false;
  if (avatar && latest.avatar !== avatar) return false;
  return true;
}

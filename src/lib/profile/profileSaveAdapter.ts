import { hasAvatarVersionConverged } from '@/lib/avatar/avatarUrl';
import {
  encode,
  type MentorExperiencePayload,
  type PersonalLinkMetadata,
  toFormValues,
} from '@/lib/profile/experienceCodec';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import {
  createEmptySocialLinks,
  SOCIAL_PLATFORM_KEYS,
  validatePlatformUrl,
} from '@/lib/profile/socialLinks';
import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';
import type { IndustryOption } from '@/types/tagCatalog';
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
    links: parsedLinks ?? createEmptySocialLinks(),
    have_topic: userDto.have_topic ?? [],
    have_skill: userDto.have_skill ?? [],
    want_position: userDto.want_position ?? [],
    want_skill: userDto.want_skill ?? [],
    want_topic: userDto.want_topic ?? [],
  };
}

/**
 * Computes dirty states for profile fields based on React Hook Form's dirtyFields,
 * deriving personal-link dirtiness directly from `SOCIAL_PLATFORM_SPECS`.
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

  const rawLinksDirty = dirtyFields?.links;
  const linksDirty = !dirtyFields
    ? true
    : typeof rawLinksDirty === 'boolean'
      ? rawLinksDirty
      : rawLinksDirty && typeof rawLinksDirty === 'object'
        ? SOCIAL_PLATFORM_KEYS.some((platform) =>
            hasDirtyValue((rawLinksDirty as Record<string, unknown>)[platform])
          )
        : false;

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
 * Filters and extracts valid personal links directly from `SOCIAL_PLATFORM_SPECS`.
 */
export function extractValidLinks(
  values: ProfileFormValues
): PersonalLinkMetadata[] {
  return SOCIAL_PLATFORM_KEYS.flatMap((platform) => {
    const rawUrl = values.links?.[platform] ?? '';
    if (!rawUrl.trim()) return [];
    const validation = validatePlatformUrl(platform, rawUrl);
    if (!validation.valid || !validation.normalizedUrl) return [];
    return [{ platform, url: validation.normalizedUrl }];
  });
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
 * Resolves the optimistic `MentorProfileVO['industry']` object from the selected
 * `subject_group` code and localized industry catalog so navigating immediately
 * to `/profile/[id]` renders the newly selected localized industry name instead
 * of a stale subject or raw code.
 */
export function resolveOptimisticIndustry(
  industryCode: string | undefined,
  industryCatalog: readonly IndustryOption[] | undefined,
  currentIndustry: MentorProfileVO['industry'] | undefined,
  industryDirty: boolean
): MentorProfileVO['industry'] {
  const normalizedCode = industryCode?.trim() ?? '';
  if (!normalizedCode) {
    return industryDirty
      ? (null as unknown as MentorProfileVO['industry'])
      : (currentIndustry ?? ({} as MentorProfileVO['industry']));
  }

  const existingTag = readIndustryTag(currentIndustry);
  const catalogMatch = industryCatalog?.find(
    (item) => item.subject_group === normalizedCode
  );
  const isSameCode = existingTag?.subject_group === normalizedCode;

  if (isSameCode && !catalogMatch && currentIndustry) {
    return currentIndustry;
  }

  const resolvedSubject =
    catalogMatch?.subject ?? (isSameCode ? (existingTag?.subject ?? '') : '');

  return {
    ...(isSameCode ? existingTag : {}),
    subject_group: normalizedCode,
    subject: resolvedSubject,
  } as unknown as MentorProfileVO['industry'];
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
  if (avatar && !hasAvatarVersionConverged(avatar, latest.avatar)) return false;
  return true;
}

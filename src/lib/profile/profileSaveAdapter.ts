import {
  DEFAULT_PRESET_AVATAR_CODE,
  toPresetAvatarCode,
} from '@/lib/avatar/avatarUrl';
import {
  encode,
  type EncodeResult,
  fromWireExperiences,
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
import type { MentorProfileWritePayload } from '@/services/profile/updateProfile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorIndustryVO, MentorProfileVO } from '@/types/user';

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
  const experiences = fromWireExperiences(userDto.experiences);

  const {
    workExperiences: parsedExperiences,
    educations: parsedEducations,
    links: parsedLinks,
  } = toFormValues(experiences);

  const industryTag = readIndustryTag(userDto.industry);
  const industrySg = industryTag?.subject_group ?? '';

  const rawAvatar = userDto.avatar?.trim() ?? '';
  const normalizedAvatar = toPresetAvatarCode(rawAvatar) ?? rawAvatar;
  const defaultAvatarFallback = isMentorOnboarding
    ? DEFAULT_PRESET_AVATAR_CODE
    : '';

  return {
    is_mentor: mentorFlag,
    avatar: normalizedAvatar || defaultAvatarFallback,
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

export interface ProfileDirtyEvaluation {
  hasExplicitDirtyFields: boolean;
  avatar: boolean;
  name: boolean;
  about: boolean;
  location: boolean;
  industry: boolean;
  yearsOfExperience: boolean;
  statement: boolean;
  haveSkill: boolean;
  haveTopic: boolean;
  wantPosition: boolean;
  wantSkill: boolean;
  wantTopic: boolean;
  work: boolean;
  education: boolean;
  links: boolean;
  experiencesDirty: boolean;
  profileDirty: boolean;
}

/**
 * Evaluates every profile form field's dirty flag in a single pass, deriving
 * personal-link dirtiness directly from `SOCIAL_PLATFORM_KEYS`.
 */
export function evaluateProfileDirtyState(
  values: ProfileFormValues,
  dirtyFields: ProfileDirtyFields | undefined,
  isMentorOnboarding: boolean,
  hasUploadedAvatar = false
): ProfileDirtyEvaluation {
  const hasExplicitDirtyFields = dirtyFields !== undefined;
  const isDirty = (key: keyof ProfileFormValues): boolean => {
    if (!dirtyFields) return true;
    return hasDirtyValue(dirtyFields[key]);
  };

  const work = isDirty('work_experiences');
  const education = isDirty('educations');

  const rawLinksDirty = dirtyFields?.links;
  const links = !dirtyFields
    ? true
    : typeof rawLinksDirty === 'boolean'
      ? rawLinksDirty
      : rawLinksDirty && typeof rawLinksDirty === 'object'
        ? SOCIAL_PLATFORM_KEYS.some((platform) =>
            hasDirtyValue((rawLinksDirty as Record<string, unknown>)[platform])
          )
        : false;

  const experiencesDirty = work || education || links;
  const avatar = isDirty('avatar');
  const name = isDirty('name');
  const about = isDirty('about');
  const location = isDirty('location');
  const industry = isDirty('industry');
  const yearsOfExperience = isDirty('years_of_experience');
  const statement = isDirty('statement');
  const haveSkill = isDirty('have_skill');
  const haveTopic = isDirty('have_topic');
  const wantPosition = isDirty('want_position');
  const wantSkill = isDirty('want_skill');
  const wantTopic = isDirty('want_topic');

  const profileDirty =
    isMentorOnboarding ||
    hasUploadedAvatar ||
    Boolean(values.avatarFile) ||
    avatar ||
    name ||
    about ||
    location ||
    industry ||
    yearsOfExperience ||
    statement ||
    haveSkill ||
    haveTopic ||
    wantPosition ||
    wantSkill ||
    wantTopic ||
    experiencesDirty;

  return {
    hasExplicitDirtyFields,
    avatar,
    name,
    about,
    location,
    industry,
    yearsOfExperience,
    statement,
    haveSkill,
    haveTopic,
    wantPosition,
    wantSkill,
    wantTopic,
    work,
    education,
    links,
    experiencesDirty,
    profileDirty,
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
  const { experiencesDirty, profileDirty } = evaluateProfileDirtyState(
    values,
    dirtyFields,
    isMentorOnboarding
  );
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

export function composeProfileWritePayload(
  values: ProfileFormValues,
  encodedExperiences: EncodeResult,
  avatar: string | undefined,
  experiencesDirty: boolean,
  currentDto?: MentorProfileVO | null,
  isMentorOnboarding = false
): MentorProfileWritePayload {
  const {
    experiences,
    job_title,
    company: companyFromPrimary,
  } = encodedExperiences;

  // Single compatibility line for backend #891 removal of personal_statement
  const personalStatement =
    values.statement ?? currentDto?.personal_statement ?? '';

  const effectiveIsMentor = isMentorOnboarding
    ? true
    : Boolean(values.is_mentor);

  // Preserve hidden opposite-role preference arrays from currentDto so Mentor
  // editing never wipes Mentee want_* tags and Mentee editing never wipes
  // Mentor have_* tags (#959).
  const resolvedWantPosition = effectiveIsMentor
    ? (currentDto?.want_position ?? values.want_position ?? [])
    : (values.want_position ?? []);
  const resolvedWantSkill = effectiveIsMentor
    ? (currentDto?.want_skill ?? values.want_skill ?? [])
    : (values.want_skill ?? []);
  const resolvedWantTopic = effectiveIsMentor
    ? (currentDto?.want_topic ?? values.want_topic ?? [])
    : (values.want_topic ?? []);
  const resolvedHaveSkill = effectiveIsMentor
    ? (values.have_skill ?? [])
    : (currentDto?.have_skill ?? values.have_skill ?? []);
  const resolvedHaveTopic = effectiveIsMentor
    ? (values.have_topic ?? [])
    : (currentDto?.have_topic ?? values.have_topic ?? []);

  const wireAvatar =
    avatar !== undefined ? (toPresetAvatarCode(avatar) ?? avatar) : undefined;

  return {
    name: values.name,
    ...(wireAvatar !== undefined ? { avatar: wireAvatar } : {}),
    location: values.location ?? '',
    years_of_experience: values.years_of_experience ?? '',
    industry: values.industry ?? '',
    language: 'zh_TW',
    is_mentor: effectiveIsMentor,
    ...(isMentorOnboarding || values.onboarding !== undefined
      ? { onboarding: isMentorOnboarding ? true : Boolean(values.onboarding) }
      : {}),
    about: values.about ?? '',
    personal_statement: personalStatement,
    job_title,
    company: companyFromPrimary,
    want_position: resolvedWantPosition,
    want_skill: resolvedWantSkill,
    want_topic: resolvedWantTopic,
    have_skill: resolvedHaveSkill,
    have_topic: resolvedHaveTopic,
    // Three-state semantic on the wire: omit when no experience section
    // changed (backend leaves the column alone); include the full set
    // when any section is dirty (backend overwrites). Replace semantics:
    // backend overwrites profiles.experiences wholesale with this batch.
    ...(experiencesDirty ? { experiences } : {}),
  };
}

/**
 * Maps `ProfileFormValues` into a canonical `MentorProfileWritePayload` for
 * `PUT /v1/mentors/{id}/profile`, ensuring `about` is normalized to `string`,
 * zero UI-only RHF keys (`work_experiences`, `educations`, `links`, `statement`,
 * `avatarFile`) leak onto the wire, and `personal_statement` conversion is
 * isolated on a single compatibility line.
 */
export function mapFormValuesToPayload(
  values: ProfileFormValues,
  avatar: string | undefined,
  experiencesDirty: boolean,
  currentDto?: MentorProfileVO | null,
  isMentorOnboarding = false
): MentorProfileWritePayload {
  const links = extractValidLinks(values);
  const encoded = encode({
    workExperiences: values.work_experiences ?? [],
    educations: values.educations ?? [],
    personalLinks: links,
  });

  return composeProfileWritePayload(
    values,
    encoded,
    avatar,
    experiencesDirty,
    currentDto,
    isMentorOnboarding
  );
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
): MentorIndustryVO | null {
  const normalizedCode = industryCode?.trim() ?? '';
  if (!normalizedCode) {
    return industryDirty ? null : (currentIndustry ?? null);
  }

  const existingTag = readIndustryTag(currentIndustry);
  const catalogMatch = industryCatalog?.find(
    (item) => item.subject_group === normalizedCode
  );
  const isSameCode =
    existingTag !== null && existingTag.subject_group === normalizedCode;

  if (isSameCode && !catalogMatch && currentIndustry) {
    return currentIndustry;
  }

  const resolvedSubject =
    catalogMatch?.subject ??
    (isSameCode && existingTag ? (existingTag.subject ?? '') : '');

  return {
    ...(isSameCode && existingTag ? existingTag : {}),
    subject_group: normalizedCode,
    subject: resolvedSubject,
  };
}

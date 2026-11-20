import type { Session } from 'next-auth';

import { toPresetAvatarCode } from '@/lib/avatar/avatarUrl';
import {
  deriveOptimisticIdentitySnapshot,
  type IdentitySnapshot,
} from '@/lib/identity/identityProjection';
import type { MentorCardFields } from '@/lib/profile/convergence';
import {
  decode,
  encode,
  fromWireExperiences,
  toWireExperiences,
} from '@/lib/profile/experienceCodec';
import {
  composeProfileWritePayload,
  evaluateProfileDirtyState,
  extractValidLinks,
  type ProfileDirtyFields,
  resolveOptimisticIndustry,
} from '@/lib/profile/profileSaveAdapter';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { ProfileFormValues } from '@/schemas/profileSchema';
import { ExperienceType } from '@/services/profile/experienceType';
import type { MentorProfileWritePayload } from '@/services/profile/updateProfile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

export type MenteeOnboardingIntentValues = Pick<
  OnboardingFormValues,
  | 'name'
  | 'avatar'
  | 'avatarFile'
  | 'language'
  | 'location'
  | 'years_of_experience'
  | 'industry'
  | 'want_position'
  | 'want_skill'
  | 'want_topic'
>;

export type ProfileMutationIntent =
  | {
      mode: 'edit' | 'mentor-onboarding';
      values: ProfileFormValues;
      dirtyFields?: ProfileDirtyFields;
      currentDto?: MentorProfileVO | null;
    }
  | {
      mode: 'mentee-onboarding';
      values: MenteeOnboardingIntentValues;
    };

export interface PlanProfileMutationContext {
  pageUserId?: string;
  session?: Session | null;
  industryCatalog?: readonly IndustryOption[];
  uploadedAvatarUrl?: string;
  now?: () => number;
}

export interface ProfileMutationPlan {
  shouldWriteProfile: boolean;
  experiencesDirty: boolean;
  wirePayload: MentorProfileWritePayload;
  identitySnapshot: IdentitySnapshot;
  optimisticDto: MentorProfileVO;
  expectedRecordDto: Partial<MentorProfileVO>;
  cardFields: MentorCardFields;
  resolvedPageUserId: string;
  validSessionUserId: number | null;
  resolvedUserId: number;
  hasValidResolvedUserId: boolean;
  resolvedLanguage: string;
  isMentorOnboarding: boolean;
}

function resolveCleanWorkField(
  dtoValue: string | null | undefined,
  sessionValue: string | null | undefined,
  payloadValue: string | undefined
): string | undefined {
  if (dtoValue !== undefined) {
    return dtoValue || undefined;
  }
  if (sessionValue !== undefined) {
    return sessionValue || undefined;
  }
  return payloadValue || undefined;
}

function buildMenteeOnboardingWritePayload(
  values: MenteeOnboardingIntentValues,
  wireAvatar: string,
  language: string
): MentorProfileWritePayload {
  return {
    name: values.name,
    avatar: wireAvatar,
    location: values.location ?? '',
    years_of_experience: values.years_of_experience ?? '',
    industry: values.industry ?? '',
    language,
    is_mentor: false,
    onboarding: true,
    about: '',
    personal_statement: '',
    want_position: values.want_position ?? [],
    want_skill: values.want_skill ?? [],
    want_topic: values.want_topic ?? [],
  };
}

/**
 * Single-pass pure planner for profile mutations (`edit`, `mentor-onboarding`,
 * and `mentee-onboarding`).
 *
 * Computes dirty-field state, primary work-experience mirroring, normalized
 * social links, wire write payload, optimistic `IdentitySnapshot`, optimistic
 * `MentorProfileVO`, and convergence `expectedRecordDto` in one synchronous
 * pass with unified sentinel semantics:
 * - `undefined` on `expectedRecordDto` = unconstrained (not checked on poll)
 * - `null` on `expectedRecordDto` = explicitly cleared / empty on backend
 * - concrete value on `expectedRecordDto` = expected target state
 */
export function planProfileMutation(
  intent: ProfileMutationIntent,
  context: PlanProfileMutationContext = {}
): ProfileMutationPlan {
  const {
    session = null,
    industryCatalog,
    uploadedAvatarUrl,
    now = () => Date.now(),
  } = context;

  const sessionUser = session?.user;
  const resolvedPageUserId = context.pageUserId ?? sessionUser?.id ?? '';
  const sessionUserId = sessionUser?.id ? Number(sessionUser.id) : null;
  const validSessionUserId =
    sessionUserId !== null && !Number.isNaN(sessionUserId)
      ? sessionUserId
      : null;
  const resolvedUserId = validSessionUserId ?? Number(resolvedPageUserId);
  const hasValidResolvedUserId =
    Boolean(resolvedUserId) && !Number.isNaN(resolvedUserId);

  const isMenteeOnboarding = intent.mode === 'mentee-onboarding';
  const isMentorOnboarding = intent.mode === 'mentor-onboarding';
  const currentDto = isMenteeOnboarding ? null : (intent.currentDto ?? null);

  const rawAvatar = uploadedAvatarUrl ?? intent.values.avatar ?? '';
  const wireAvatar = rawAvatar
    ? (toPresetAvatarCode(rawAvatar) ?? rawAvatar)
    : '';

  const previousAvatarRaw = sessionUser?.avatar || currentDto?.avatar || '';
  const previousAvatar = previousAvatarRaw
    ? (toPresetAvatarCode(previousAvatarRaw) ?? previousAvatarRaw)
    : '';

  if (isMenteeOnboarding) {
    const resolvedLanguage = intent.values.language || 'zh_TW';
    const wirePayload = buildMenteeOnboardingWritePayload(
      intent.values,
      wireAvatar,
      resolvedLanguage
    );

    const fallbackAvatar =
      sessionUser?.avatar || (wireAvatar ? wireAvatar : null);
    const didAvatarChange =
      Boolean(intent.values.avatarFile) ||
      Boolean(uploadedAvatarUrl) ||
      (Boolean(wireAvatar) && wireAvatar !== previousAvatar);

    const identitySnapshot = deriveOptimisticIdentitySnapshot({
      name: intent.values.name,
      avatarUrl: wireAvatar ? wireAvatar : undefined,
      avatarUpdatedAt: didAvatarChange ? now() : sessionUser?.avatarUpdatedAt,
      isMentorOnboarding: false,
      fallbackAvatar,
      fallbackIsMentor: false,
      fallbackOnBoarding: true,
      jobTitle: undefined,
      company: undefined,
      personalLinks: [],
    });

    const optimisticIndustry = resolveOptimisticIndustry(
      intent.values.industry,
      industryCatalog,
      undefined,
      true
    );

    const optimisticDto: MentorProfileVO = {
      user_id: resolvedUserId,
      name: identitySnapshot.name,
      avatar: identitySnapshot.avatar,
      job_title: null,
      company: null,
      years_of_experience: intent.values.years_of_experience || null,
      location: intent.values.location || null,
      personal_statement: null,
      about: null,
      seniority_level: null,
      onboarding: true,
      is_mentor: false,
      language: resolvedLanguage,
      industry: optimisticIndustry,
      want_position: wirePayload.want_position ?? [],
      want_skill: wirePayload.want_skill ?? [],
      want_topic: wirePayload.want_topic ?? [],
      have_skill: [],
      have_topic: [],
      experiences: [],
    };

    const expectedRecordDto: Partial<MentorProfileVO> = {
      name: optimisticDto.name,
      avatar: wireAvatar ? wireAvatar : undefined,
      location: optimisticDto.location,
      years_of_experience: optimisticDto.years_of_experience,
      personal_statement: optimisticDto.personal_statement,
      about: optimisticDto.about,
      industry: optimisticDto.industry,
      want_position: optimisticDto.want_position,
      want_skill: optimisticDto.want_skill,
      want_topic: optimisticDto.want_topic,
      have_skill: optimisticDto.have_skill,
      have_topic: optimisticDto.have_topic,
      job_title: undefined,
      company: undefined,
      experiences: undefined,
      is_mentor: false,
      onboarding: true,
    };

    return {
      shouldWriteProfile: true,
      experiencesDirty: false,
      wirePayload,
      identitySnapshot,
      optimisticDto,
      expectedRecordDto,
      cardFields: {
        name: wirePayload.name,
        jobTitle: '',
        company: '',
        about: wirePayload.about,
        yearsOfExperience: wirePayload.years_of_experience,
        haveTopic: [],
        haveSkill: [],
        avatar: wireAvatar,
      },
      resolvedPageUserId,
      validSessionUserId,
      resolvedUserId,
      hasValidResolvedUserId,
      resolvedLanguage,
      isMentorOnboarding: false,
    };
  }

  // Single-pass dirty evaluation + experience/link encoding for edit & mentor-onboarding
  const dirty = evaluateProfileDirtyState(
    intent.values,
    intent.dirtyFields,
    isMentorOnboarding,
    Boolean(uploadedAvatarUrl)
  );
  const { hasExplicitDirtyFields, experiencesDirty } = dirty;

  const validLinks = extractValidLinks(intent.values);
  const encodedExperiences = encode({
    workExperiences: intent.values.work_experiences ?? [],
    educations: intent.values.educations ?? [],
    personalLinks: validLinks,
  });

  const wirePayload = composeProfileWritePayload(
    intent.values,
    encodedExperiences,
    wireAvatar,
    experiencesDirty,
    currentDto,
    isMentorOnboarding
  );

  const avatarClearIntent = hasExplicitDirtyFields
    ? dirty.avatar
    : Boolean(previousAvatar);
  const avatarExplicitlyCleared =
    avatarClearIntent &&
    !wireAvatar &&
    !intent.values.avatarFile &&
    !uploadedAvatarUrl;

  const fallbackAvatar = avatarExplicitlyCleared
    ? null
    : sessionUser?.avatar ||
      currentDto?.avatar ||
      (wireAvatar ? wireAvatar : null);

  const didAvatarChange =
    avatarExplicitlyCleared ||
    Boolean(intent.values.avatarFile) ||
    Boolean(uploadedAvatarUrl) ||
    (Boolean(wireAvatar) && wireAvatar !== previousAvatar);

  const optimisticJobTitle = dirty.work
    ? wirePayload.job_title || undefined
    : resolveCleanWorkField(
        currentDto?.job_title,
        sessionUser?.jobTitle,
        wirePayload.job_title
      );

  const optimisticCompany = dirty.work
    ? wirePayload.company || undefined
    : resolveCleanWorkField(
        currentDto?.company,
        sessionUser?.company,
        wirePayload.company
      );

  const optimisticPersonalLinks = experiencesDirty
    ? validLinks.map((link) => ({
        platform: link.platform,
        url: link.url,
      }))
    : currentDto?.experiences !== undefined && currentDto.experiences !== null
      ? decode(fromWireExperiences(currentDto.experiences)).personalLinks
      : sessionUser?.personalLinks && sessionUser.personalLinks.length > 0
        ? decode([
            {
              category: ExperienceType.LINK,
              order: 3,
              mentor_experiences_metadata: {
                data: sessionUser.personalLinks,
              },
            },
          ]).personalLinks
        : [];

  const identitySnapshot = deriveOptimisticIdentitySnapshot({
    name: intent.values.name,
    avatarUrl: wireAvatar ? wireAvatar : undefined,
    avatarUpdatedAt: didAvatarChange ? now() : sessionUser?.avatarUpdatedAt,
    isMentorOnboarding,
    fallbackAvatar,
    fallbackIsMentor:
      sessionUser?.isMentor ??
      currentDto?.is_mentor ??
      intent.values.is_mentor ??
      false,
    fallbackOnBoarding:
      sessionUser?.onBoarding ??
      currentDto?.onboarding ??
      intent.values.onboarding ??
      false,
    jobTitle: optimisticJobTitle,
    company: optimisticCompany,
    personalLinks: optimisticPersonalLinks,
  });

  const optimisticIndustry = resolveOptimisticIndustry(
    intent.values.industry,
    industryCatalog,
    currentDto?.industry,
    dirty.industry
  );

  const resolvedExperiences =
    wirePayload.experiences !== undefined
      ? toWireExperiences(wirePayload.experiences)
      : currentDto?.experiences !== undefined && currentDto.experiences !== null
        ? currentDto.experiences
        : identitySnapshot.personalLinks.length > 0
          ? toWireExperiences([
              {
                category: ExperienceType.LINK,
                order: 3,
                mentor_experiences_metadata: {
                  data: identitySnapshot.personalLinks.map((link) => ({
                    platform: link.platform,
                    url: link.url,
                  })),
                },
              },
            ])
          : null;

  const resolvedLanguage = 'zh_TW';

  const optimisticDto: MentorProfileVO = {
    ...(currentDto ?? {}),
    user_id: resolvedUserId,
    name: identitySnapshot.name,
    avatar: identitySnapshot.avatar,
    job_title: identitySnapshot.jobTitle ?? null,
    company: identitySnapshot.company ?? null,
    years_of_experience: dirty.yearsOfExperience
      ? wirePayload.years_of_experience || null
      : wirePayload.years_of_experience ||
        currentDto?.years_of_experience ||
        null,
    location: dirty.location
      ? wirePayload.location || null
      : wirePayload.location || currentDto?.location || null,
    personal_statement:
      dirty.statement && intent.values.statement !== undefined
        ? wirePayload.personal_statement || null
        : wirePayload.personal_statement ||
          currentDto?.personal_statement ||
          null,
    about: dirty.about
      ? wirePayload.about || null
      : wirePayload.about || currentDto?.about || null,
    seniority_level: currentDto?.seniority_level ?? null,
    onboarding: identitySnapshot.onBoarding,
    is_mentor: identitySnapshot.isMentor,
    language: resolvedLanguage,
    industry: optimisticIndustry,
    want_position: wirePayload.want_position ?? [],
    want_skill: wirePayload.want_skill ?? [],
    want_topic: wirePayload.want_topic ?? [],
    have_skill: wirePayload.have_skill ?? [],
    have_topic: wirePayload.have_topic ?? [],
    experiences: resolvedExperiences,
  };

  const expectedRecordDto: Partial<MentorProfileVO> = {
    name: optimisticDto.name,
    avatar: avatarExplicitlyCleared ? null : wireAvatar || undefined,
    location: optimisticDto.location,
    years_of_experience: optimisticDto.years_of_experience,
    personal_statement: optimisticDto.personal_statement,
    about: optimisticDto.about,
    industry: optimisticDto.industry,
    want_position: optimisticDto.want_position,
    want_skill: optimisticDto.want_skill,
    want_topic: optimisticDto.want_topic,
    have_skill: optimisticDto.have_skill,
    have_topic: optimisticDto.have_topic,
    job_title: experiencesDirty ? optimisticDto.job_title : undefined,
    company: experiencesDirty ? optimisticDto.company : undefined,
    experiences: experiencesDirty ? optimisticDto.experiences : undefined,
    is_mentor: intent.mode === 'edit' ? undefined : optimisticDto.is_mentor,
    onboarding: intent.mode === 'edit' ? undefined : optimisticDto.onboarding,
  };

  return {
    shouldWriteProfile: dirty.profileDirty,
    experiencesDirty,
    wirePayload,
    identitySnapshot,
    optimisticDto,
    expectedRecordDto,
    cardFields: {
      name: wirePayload.name,
      jobTitle: wirePayload.job_title ?? '',
      company: wirePayload.company ?? '',
      about: wirePayload.about,
      yearsOfExperience: wirePayload.years_of_experience,
      haveTopic: wirePayload.have_topic ?? [],
      haveSkill: wirePayload.have_skill ?? [],
      avatar: wireAvatar,
    },
    resolvedPageUserId,
    validSessionUserId,
    resolvedUserId,
    hasValidResolvedUserId,
    resolvedLanguage,
    isMentorOnboarding,
  };
}

import type { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
} from '@/lib/cache/userProfileDtoCache';
import { getPendingFavoriteProfilePath } from '@/lib/favorites';
import {
  applyIdentityPatch,
  deriveOptimisticIdentityPatch,
  type IdentityPatch,
  reconcileIdentityWithBackend,
} from '@/lib/identity/identityProjection';
import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  CONVERGENCE_BUDGET,
  FAST_CONVERGENCE_BUDGET,
  type FetchProfileRecordFn,
  type MentorCardFields,
  ProfileRecordAdapter,
  runConvergence,
  SearchIndexSyncAdapter,
  type SearchMentorsFn,
} from '@/lib/profile/convergence';
import {
  type MentorExperiencePayload,
  toWireExperiences,
} from '@/lib/profile/experienceCodec';
import { confirmProfileSynced } from '@/lib/profile/pollUntilSynced';
import {
  computeDirtyStates,
  extractValidLinks,
  hasDirtyValue,
  mapFormValuesToPayload,
  type ProfileDirtyFields,
  resolveOptimisticIndustry,
} from '@/lib/profile/profileSaveAdapter';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { ProfileFormValues } from '@/schemas/profileSchema';
import { updateAvatar } from '@/services/profile/updateAvatar';
import {
  type MentorProfileWritePayload,
  updateProfile,
} from '@/services/profile/updateProfile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

const DEFAULT_FAST_FETCH_TIMEOUT_MS = 800;

/**
 * Custom error subclass marking errors that have already been explicitly logged
 * via `captureFlowFailure` inside `commitProfileMutation`, preventing
 * double-reporting by outer hooks.
 */
export class LoggedError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LoggedError';
  }
}

export interface SaveProfileConvergenceBudget {
  fastFetchTimeoutMs?: number;
  profileMaxRetries?: number;
  profileIntervalMs?: number;
  searchIndexMaxRetries?: number;
  searchIndexIntervalMs?: number;
}

export type ProfileMutationIntent =
  | {
      mode: 'edit' | 'mentor-onboarding';
      values: ProfileFormValues;
      dirtyFields?: ProfileDirtyFields;
      currentDto?: MentorProfileVO | null;
    }
  | {
      mode: 'mentee-onboarding';
      values: OnboardingFormValues;
    };

export interface CommitProfileContext {
  pageUserId?: string;
  session?: Session | null;
  industryCatalog?: readonly IndustryOption[];
  convergenceBudget?: SaveProfileConvergenceBudget;
  navigationTarget?: string;
}

export interface SaveProfileContext {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session?: Session | null;
  dirtyFields?: ProfileDirtyFields;
  currentDto?: MentorProfileVO | null;
  industryCatalog?: readonly IndustryOption[];
  convergenceBudget?: SaveProfileConvergenceBudget;
}

export interface ProfileSavePort {
  uploadAvatar?: (
    file: File,
    userId: number | undefined
  ) => Promise<string | undefined>;
  writeProfile?: (
    pageUserId: string,
    payload: MentorProfileWritePayload
  ) => Promise<void>;
  fetchProfile?: FetchProfileRecordFn;
  searchMentors?: SearchMentorsFn;
  updateSession: (data: unknown) => Promise<Session | null>;
  revalidateProfilePath: (pageUserId: string) => Promise<void>;
  navigate: (path: string) => void;
}

export type SaveProfileAdapters = ProfileSavePort;

export interface SaveProfileDeps extends SaveProfileContext, ProfileSavePort {}

async function fastSyncProfileRecord(
  userId: number,
  expectedDto: Partial<MentorProfileVO>,
  timeoutMs: number,
  fetchProfileFn?: FetchProfileRecordFn
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const adapter = new ProfileRecordAdapter(userId, expectedDto, fetchProfileFn);

  const fetchPromise = adapter
    .fetch()
    .then((latest) => {
      if (latest && adapter.isCaughtUp(latest)) return latest;
      return null;
    })
    .catch(() => null);

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildMenteeOnboardingWritePayload(
  values: OnboardingFormValues,
  avatar: string
): MentorProfileWritePayload {
  return {
    name: values.name,
    avatar,
    location: values.location ?? '',
    years_of_experience: values.years_of_experience ?? '',
    industry: values.industry ?? '',
    language: values.language || 'zh_TW',
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
 * Shared profile write pipeline across `edit`, `mentor-onboarding`, and
 * `mentee-onboarding` modes:
 * 1. Uploads any pending `avatarFile` via S3 presigned POST (`uploadAvatar`)
 * 2. Encodes canonical `MentorProfileWritePayload` (`about` normalized to `string`,
 *    zero UI-only RHF keys leaked) and writes to `PUT /v1/mentors/{id}/profile`
 * 3. Clears `userProfileDtoCache` + `mentorPoolReadModel` and triggers ISR revalidation
 * 4. Applies synchronous optimistic `MentorProfileVO` priming + NextAuth session patch
 * 5. Navigates immediately to target route
 * 6. Runs background full-field convergence (`ProfileRecordAdapter` + mentor search index)
 */
export async function commitProfileMutation(
  intent: ProfileMutationIntent,
  context: CommitProfileContext,
  port: ProfileSavePort
): Promise<MentorProfileVO> {
  const {
    session = null,
    industryCatalog,
    convergenceBudget,
    navigationTarget,
  } = context;
  const {
    uploadAvatar: uploadAvatarPort,
    writeProfile: writeProfilePort,
    fetchProfile: fetchProfilePort,
    searchMentors: searchMentorsPort,
    updateSession,
    revalidateProfilePath,
    navigate,
  } = port;

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

  const isMentorOnboarding = intent.mode === 'mentor-onboarding';
  const currentDto =
    intent.mode === 'mentee-onboarding' ? null : (intent.currentDto ?? null);
  const dirtyFields =
    intent.mode === 'mentee-onboarding' ? undefined : intent.dirtyFields;

  const fastFetchTimeoutMs =
    convergenceBudget?.fastFetchTimeoutMs ?? DEFAULT_FAST_FETCH_TIMEOUT_MS;
  const profileMaxRetries =
    convergenceBudget?.profileMaxRetries ?? CONVERGENCE_BUDGET.maxRetries;
  const profileIntervalMs =
    convergenceBudget?.profileIntervalMs ?? CONVERGENCE_BUDGET.intervalMs;
  const searchIndexMaxRetries =
    convergenceBudget?.searchIndexMaxRetries ??
    FAST_CONVERGENCE_BUDGET.maxRetries;
  const searchIndexIntervalMs =
    convergenceBudget?.searchIndexIntervalMs ??
    FAST_CONVERGENCE_BUDGET.intervalMs;

  // Step 1: Upload Avatar
  async function step1UploadAvatar(): Promise<string | undefined> {
    let avatarUrl = intent.values.avatar;
    if (intent.values.avatarFile) {
      try {
        const uploadTargetUserId =
          validSessionUserId ??
          (hasValidResolvedUserId ? resolvedUserId : undefined);
        const uploader = uploadAvatarPort
          ? uploadAvatarPort(intent.values.avatarFile, uploadTargetUserId)
          : updateAvatar(intent.values.avatarFile, uploadTargetUserId);
        const newUrl = await uploader;
        avatarUrl = newUrl ?? avatarUrl;
      } catch (err) {
        captureFlowFailure({
          flow: 'profile_update',
          step: 'avatar_upload',
          message: err instanceof Error ? err.message : 'Avatar upload failed',
          level: 'warning',
        });
        throw new LoggedError(
          err instanceof Error ? err.message : 'Avatar upload failed',
          { cause: err }
        );
      }
    }
    return avatarUrl;
  }

  // Step 2: Write Profile & Experiences
  async function step2WriteProfile(avatarUrl: string | undefined): Promise<{
    payload: MentorProfileWritePayload;
    experiencesDirty: boolean;
  }> {
    let payload: MentorProfileWritePayload;
    let profileDirty = true;
    let experiencesDirty = false;

    if (intent.mode === 'mentee-onboarding') {
      payload = buildMenteeOnboardingWritePayload(
        intent.values,
        avatarUrl ?? ''
      );
    } else {
      const dirtyState = computeDirtyStates(
        intent.values,
        dirtyFields,
        isMentorOnboarding
      );
      experiencesDirty = dirtyState.experiencesDirty;
      profileDirty = dirtyState.profileDirty;
      payload = mapFormValuesToPayload(
        intent.values,
        avatarUrl ?? '',
        experiencesDirty,
        currentDto,
        isMentorOnboarding
      );
    }

    try {
      if (profileDirty) {
        const writeFn = writeProfilePort ?? updateProfile;
        await writeFn(resolvedPageUserId, payload);
      }
    } catch (err) {
      captureFlowFailure({
        flow: 'profile_update',
        step: 'profile_write',
        message: err instanceof Error ? err.message : 'Profile write failed',
      });
      throw new LoggedError(
        err instanceof Error ? err.message : 'Profile write failed',
        { cause: err }
      );
    }
    return { payload, experiencesDirty };
  }

  // Step 3: Cache Invalidation & Server Path Revalidation
  async function step3InvalidateCachesAndRevalidate() {
    if (hasValidResolvedUserId) {
      clearUserProfileDtoCache(resolvedUserId, 'zh_TW');
    }
    mentorPoolReadModel.clear();

    if (resolvedPageUserId) {
      await revalidateProfilePath(resolvedPageUserId).catch((e) => {
        console.error('revalidateProfilePath failed:', e);
      });
    }
  }

  // Step 4: Apply the optimistic identity patch & prime DTO cache
  const workDirty = Boolean(
    dirtyFields && hasDirtyValue(dirtyFields.work_experiences)
  );

  function buildSessionIdentityUpdater(
    avatarUrl: string | undefined,
    jobTitle: string | undefined,
    company: string | undefined
  ): (patch: IdentityPatch) => Promise<Session | null> {
    const personalLinks =
      intent.mode === 'mentee-onboarding'
        ? []
        : extractValidLinks(intent.values).map((link) => ({
            platform: link.platform,
            url: link.url,
          }));

    const previousAvatar = sessionUser?.avatar || currentDto?.avatar || '';
    const resolvedAvatar = avatarUrl || '';
    const didAvatarChange =
      Boolean(intent.values.avatarFile) ||
      (Boolean(resolvedAvatar) && resolvedAvatar !== previousAvatar);

    const nextAvatarUpdatedAt = didAvatarChange
      ? Date.now()
      : sessionUser?.avatarUpdatedAt;

    return (patch: IdentityPatch) =>
      updateSession({
        user: {
          id: sessionUser?.id,
          name: patch.name,
          avatar: patch.avatar,
          avatarUpdatedAt: nextAvatarUpdatedAt,
          isMentor: patch.isMentor,
          onBoarding: patch.onBoarding,
          msg: sessionUser?.msg,
          personalLinks,
          jobTitle:
            intent.mode === 'mentee-onboarding'
              ? undefined
              : workDirty
                ? jobTitle || undefined
                : jobTitle || sessionUser?.jobTitle,
          company:
            intent.mode === 'mentee-onboarding'
              ? undefined
              : workDirty
                ? company || undefined
                : company || sessionUser?.company,
        },
      });
  }

  async function step4ApplyOptimisticIdentity(
    identityPatch: IdentityPatch,
    updateSessionIdentity: (patch: IdentityPatch) => Promise<Session | null>,
    payload: MentorProfileWritePayload,
    experiencesPayload: MentorExperiencePayload[] | undefined
  ): Promise<MentorProfileVO> {
    const industryDirty =
      intent.mode === 'mentee-onboarding'
        ? true
        : Boolean(dirtyFields && hasDirtyValue(dirtyFields.industry));
    const aboutDirty =
      intent.mode !== 'mentee-onboarding' &&
      Boolean(dirtyFields && hasDirtyValue(dirtyFields.about));
    const statementDirty =
      intent.mode !== 'mentee-onboarding' &&
      Boolean(dirtyFields && hasDirtyValue(dirtyFields.statement));

    const optimisticIndustry = resolveOptimisticIndustry(
      intent.values.industry,
      industryCatalog,
      currentDto?.industry,
      industryDirty
    );

    const resolvedExperiences =
      experiencesPayload !== undefined
        ? toWireExperiences(experiencesPayload)
        : (currentDto?.experiences ??
          (intent.mode === 'mentee-onboarding' ? [] : null));

    const resolvedLanguage =
      intent.mode === 'mentee-onboarding'
        ? intent.values.language || 'zh_TW'
        : 'zh_TW';

    const optimisticDto: MentorProfileVO = {
      ...(currentDto ?? {}),
      user_id: resolvedUserId,
      name: identityPatch.name,
      avatar: identityPatch.avatar,
      job_title:
        intent.mode === 'mentee-onboarding'
          ? null
          : workDirty
            ? payload.job_title || null
            : payload.job_title || currentDto?.job_title || null,
      company:
        intent.mode === 'mentee-onboarding'
          ? null
          : workDirty
            ? payload.company || null
            : payload.company || currentDto?.company || null,
      years_of_experience:
        intent.values.years_of_experience ||
        currentDto?.years_of_experience ||
        null,
      location: intent.values.location || currentDto?.location || null,
      personal_statement:
        intent.mode === 'mentee-onboarding'
          ? null
          : statementDirty
            ? payload.personal_statement || null
            : payload.personal_statement ||
              currentDto?.personal_statement ||
              null,
      about:
        intent.mode === 'mentee-onboarding'
          ? null
          : aboutDirty
            ? payload.about || null
            : payload.about || currentDto?.about || null,
      seniority_level: currentDto?.seniority_level ?? null,
      onboarding: identityPatch.onBoarding ?? null,
      is_mentor: identityPatch.isMentor ?? null,
      language: resolvedLanguage,
      industry: optimisticIndustry,
      want_position: intent.values.want_position ?? [],
      want_skill: intent.values.want_skill ?? [],
      want_topic: intent.values.want_topic ?? [],
      have_skill:
        intent.mode === 'mentee-onboarding'
          ? []
          : (intent.values.have_skill ?? []),
      have_topic:
        intent.mode === 'mentee-onboarding'
          ? []
          : (intent.values.have_topic ?? []),
      experiences: resolvedExperiences,
    };

    await applyIdentityPatch(identityPatch, {
      primeProfileDto: () => {
        if (hasValidResolvedUserId) {
          primeUserProfileDtoCache(
            resolvedUserId,
            resolvedLanguage,
            optimisticDto
          );
        }
      },
      updateSession: updateSessionIdentity,
    });

    return optimisticDto;
  }

  // Step 5: Immediate Navigation
  function step5ImmediateNavigation() {
    if (intent.mode === 'mentee-onboarding') {
      trackEvent({ name: 'onboarding_completed', feature: 'onboarding' });
      const target =
        navigationTarget ?? getPendingFavoriteProfilePath() ?? '/profile/card';
      navigate(target);
      return;
    }

    trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
    if (navigationTarget) {
      navigate(navigationTarget);
    } else if (isMentorOnboarding) {
      navigate('/profile/card');
    } else {
      navigate(`/profile/${resolvedPageUserId}`);
    }
  }

  // Step 6: Background Prime & Reconcile
  function step6BackgroundReconcile(
    avatarUrl: string | undefined,
    payload: MentorProfileWritePayload,
    experiencesDirty: boolean,
    optimisticDto: MentorProfileVO,
    identityPatch: IdentityPatch,
    updateSessionIdentity: (patch: IdentityPatch) => Promise<Session | null>
  ) {
    const expectedRecordDto: Partial<MentorProfileVO> = {
      name: optimisticDto.name,
      avatar: avatarUrl || undefined,
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
      is_mentor: intent.mode === 'edit' ? null : optimisticDto.is_mentor,
      onboarding: intent.mode === 'edit' ? null : optimisticDto.onboarding,
    };

    const resolvedLanguage = optimisticDto.language || 'zh_TW';

    void (async () => {
      try {
        let latest: MentorProfileVO | null = null;
        if (validSessionUserId) {
          latest = await fastSyncProfileRecord(
            validSessionUserId,
            expectedRecordDto,
            fastFetchTimeoutMs,
            fetchProfilePort
          );
          if (latest) {
            primeUserProfileDtoCache(
              validSessionUserId,
              resolvedLanguage,
              latest
            );
          }
        }
        if (!latest && hasValidResolvedUserId) {
          const recordAdapter = new ProfileRecordAdapter(
            resolvedUserId,
            expectedRecordDto,
            fetchProfilePort
          );
          const { confirmed, latest: polled } = await runConvergence(
            recordAdapter,
            profileMaxRetries,
            profileIntervalMs
          );
          latest = polled;
          if (confirmed && polled) {
            primeUserProfileDtoCache(resolvedUserId, resolvedLanguage, polled);
          }
        }

        await reconcileIdentityWithBackend(identityPatch, latest, {
          updateSession: updateSessionIdentity,
        });

        const isMentorRelevant =
          intent.mode === 'mentee-onboarding'
            ? false
            : isMentorOnboarding ||
              Boolean(sessionUser?.isMentor) ||
              Boolean(latest?.is_mentor);

        const cardFields: MentorCardFields = {
          name: payload.name,
          jobTitle: payload.job_title ?? '',
          company: payload.company ?? '',
          about: payload.about,
          yearsOfExperience: payload.years_of_experience,
          haveTopic: payload.have_topic ?? [],
          haveSkill: payload.have_skill ?? [],
          avatar: avatarUrl ?? '',
        };

        await confirmProfileSynced(
          resolvedUserId,
          cardFields,
          isMentorRelevant,
          async () => {
            mentorPoolReadModel.clear();
            if (resolvedPageUserId) {
              await revalidateProfilePath(resolvedPageUserId).catch(
                (e: unknown) => {
                  captureFlowFailure({
                    flow: 'profile_update',
                    step: 'post_sync_revalidate',
                    message: e instanceof Error ? e.message : String(e),
                    level: 'warning',
                  });
                }
              );
            }
          },
          async (id, fields) => {
            if (!id || Number.isNaN(id)) return true;
            const searchAdapter = new SearchIndexSyncAdapter(
              id,
              fields,
              searchMentorsPort
            );
            const { confirmed } = await runConvergence(
              searchAdapter,
              searchIndexMaxRetries,
              searchIndexIntervalMs
            );
            return confirmed;
          }
        );
      } catch (e) {
        captureFlowFailure({
          flow: 'profile_update',
          step: 'background_reconcile',
          message: String(e),
        });
      }
    })();
  }

  // Enforce the execution order of the six steps structurally
  const avatarUrl = await step1UploadAvatar();
  const { payload, experiencesDirty } = await step2WriteProfile(avatarUrl);
  await step3InvalidateCachesAndRevalidate();

  const avatarExplicitlyCleared =
    intent.mode !== 'mentee-onboarding' &&
    Boolean(dirtyFields && hasDirtyValue(dirtyFields.avatar)) &&
    !avatarUrl &&
    !intent.values.avatarFile;

  const fallbackAvatar = avatarExplicitlyCleared
    ? null
    : sessionUser?.avatar ||
      currentDto?.avatar ||
      (intent.values.avatar ? intent.values.avatar : null);

  const identityPatch = deriveOptimisticIdentityPatch({
    name: intent.values.name,
    avatarUrl: avatarUrl ? avatarUrl : undefined,
    isMentorOnboarding,
    fallbackAvatar,
    fallbackIsMentor:
      intent.mode === 'mentee-onboarding'
        ? false
        : (sessionUser?.isMentor ??
          currentDto?.is_mentor ??
          intent.values.is_mentor ??
          false),
    fallbackOnBoarding:
      intent.mode === 'mentee-onboarding'
        ? true
        : (sessionUser?.onBoarding ??
          currentDto?.onboarding ??
          intent.values.onboarding ??
          false),
  });

  const updateSessionIdentity = buildSessionIdentityUpdater(
    avatarUrl,
    payload.job_title,
    payload.company
  );

  const optimisticDto = await step4ApplyOptimisticIdentity(
    identityPatch,
    updateSessionIdentity,
    payload,
    payload.experiences
  );
  step5ImmediateNavigation();
  step6BackgroundReconcile(
    avatarUrl,
    payload,
    experiencesDirty,
    optimisticDto,
    identityPatch,
    updateSessionIdentity
  );

  return optimisticDto;
}

/**
 * Compatibility wrapper retained for Stage 1 callers (`useProfileSubmit`)
 * delegating directly to canonical `commitProfileMutation`.
 */
export async function saveProfile(
  values: ProfileFormValues,
  context: SaveProfileContext,
  port: ProfileSavePort
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  deps: SaveProfileDeps
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  contextOrDeps: SaveProfileContext | SaveProfileDeps,
  portArg?: ProfileSavePort
): Promise<MentorProfileVO> {
  const port: ProfileSavePort = portArg
    ? portArg
    : 'updateSession' in contextOrDeps
      ? contextOrDeps
      : (() => {
          throw new Error('Missing ProfileSavePort');
        })();

  return commitProfileMutation(
    {
      mode: contextOrDeps.isMentorOnboarding ? 'mentor-onboarding' : 'edit',
      values,
      dirtyFields: contextOrDeps.dirtyFields,
      currentDto: contextOrDeps.currentDto,
    },
    {
      pageUserId: contextOrDeps.pageUserId,
      session: contextOrDeps.session,
      industryCatalog: contextOrDeps.industryCatalog,
      convergenceBudget: contextOrDeps.convergenceBudget,
    },
    port
  );
}

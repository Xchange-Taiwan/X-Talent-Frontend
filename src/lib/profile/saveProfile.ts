import type { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
} from '@/lib/cache/userProfileDtoCache';
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
import { confirmProfileSynced } from '@/lib/profile/pollUntilSynced';
import {
  computeDirtyStates,
  extractValidLinks,
  hasDirtyValue,
  mapFormValuesToPayload,
  type ProfileDirtyFields,
  resolveOptimisticIndustry,
} from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';
import { updateAvatar } from '@/services/profile/updateAvatar';
import {
  updateProfile,
  type UpdateProfileInput,
} from '@/services/profile/updateProfile';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

const DEFAULT_FAST_FETCH_TIMEOUT_MS = 800;

/**
 * Custom error subclass marking errors that have already been explicitly logged
 * via `captureFlowFailure` inside `saveProfile`, preventing double-reporting by
 * outer hooks.
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
    payload: UpdateProfileInput
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
  values: ProfileFormValues,
  avatar: string,
  timeoutMs: number,
  fetchProfileFn?: FetchProfileRecordFn
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const adapter = new ProfileRecordAdapter(
    userId,
    values,
    avatar,
    fetchProfileFn
  );

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
  const deps: SaveProfileDeps = portArg
    ? {
        ...contextOrDeps,
        ...portArg,
      }
    : (contextOrDeps as SaveProfileDeps);

  const {
    pageUserId,
    isMentorOnboarding,
    dirtyFields,
    session = null,
    currentDto,
    industryCatalog,
    convergenceBudget,
    uploadAvatar: uploadAvatarPort,
    writeProfile: writeProfilePort,
    fetchProfile: fetchProfilePort,
    searchMentors: searchMentorsPort,
    updateSession,
    revalidateProfilePath,
    navigate,
  } = deps;

  const sessionUserId = session?.user?.id ? Number(session.user.id) : null;
  const sessionUser = session?.user;
  const resolvedUserId = sessionUserId ?? Number(pageUserId);
  const hasValidResolvedUserId =
    Boolean(resolvedUserId) && !Number.isNaN(resolvedUserId);

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
    let avatarUrl = values.avatar;
    if (values.avatarFile) {
      try {
        const uploader = uploadAvatarPort
          ? uploadAvatarPort(values.avatarFile, sessionUserId ?? undefined)
          : updateAvatar(values.avatarFile, sessionUserId ?? undefined);
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
  async function step2WriteProfile(avatarUrl: string | undefined) {
    const { experiencesDirty, profileDirty } = computeDirtyStates(
      values,
      dirtyFields,
      isMentorOnboarding
    );

    const payload = mapFormValuesToPayload(
      values,
      avatarUrl ?? '',
      experiencesDirty
    );

    try {
      if (profileDirty) {
        const writeFn = writeProfilePort ?? updateProfile;
        await writeFn(pageUserId, payload);
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
    return { payload };
  }

  // Step 3: Cache Invalidation & Server Path Revalidation
  async function step3InvalidateCachesAndRevalidate() {
    if (hasValidResolvedUserId) {
      clearUserProfileDtoCache(resolvedUserId, 'zh_TW');
    }
    mentorPoolReadModel.clear();

    await revalidateProfilePath(pageUserId).catch((e) => {
      console.error('revalidateProfilePath failed:', e);
    });
  }

  // Step 4: Apply the optimistic identity patch (Ticket 670 & #889)
  const workDirty = Boolean(
    dirtyFields && hasDirtyValue(dirtyFields.work_experiences)
  );

  function buildSessionIdentityUpdater(
    jobTitle: string | undefined,
    company: string | undefined
  ): (patch: IdentityPatch) => Promise<Session | null> {
    const personalLinks = extractValidLinks(values).map((link) => ({
      platform: link.platform,
      url: link.url,
    }));

    const nextAvatarUpdatedAt = values.avatarFile
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
          jobTitle: workDirty
            ? jobTitle || undefined
            : jobTitle || sessionUser?.jobTitle,
          company: workDirty
            ? company || undefined
            : company || sessionUser?.company,
        },
      });
  }

  async function step4ApplyOptimisticIdentity(
    identityPatch: IdentityPatch,
    updateSessionIdentity: (patch: IdentityPatch) => Promise<Session | null>,
    jobTitle?: string,
    company?: string,
    experiencesPayload?: unknown
  ): Promise<MentorProfileVO> {
    const experiences = experiencesPayload ?? currentDto?.experiences ?? null;
    const industryDirty = Boolean(
      dirtyFields && hasDirtyValue(dirtyFields.industry)
    );
    const aboutDirty = Boolean(dirtyFields && hasDirtyValue(dirtyFields.about));
    const statementDirty = Boolean(
      dirtyFields && hasDirtyValue(dirtyFields.statement)
    );
    const optimisticIndustry = resolveOptimisticIndustry(
      values.industry,
      industryCatalog,
      currentDto?.industry,
      industryDirty
    );

    const optimisticDto = {
      ...currentDto,
      user_id: resolvedUserId,
      name: identityPatch.name,
      avatar: identityPatch.avatar,
      job_title: workDirty
        ? jobTitle || null
        : jobTitle || currentDto?.job_title || null,
      company: workDirty
        ? company || null
        : company || currentDto?.company || null,
      years_of_experience:
        values.years_of_experience || currentDto?.years_of_experience || null,
      location: values.location || currentDto?.location || null,
      personal_statement: statementDirty
        ? values.statement || null
        : values.statement || currentDto?.personal_statement || null,
      about: aboutDirty
        ? values.about || null
        : values.about || currentDto?.about || null,
      seniority_level: currentDto?.seniority_level ?? null,
      onboarding: identityPatch.onBoarding,
      is_mentor: identityPatch.isMentor,
      language: 'zh_TW',
      industry: optimisticIndustry,
      want_position: values.want_position,
      want_skill: values.want_skill,
      want_topic: values.want_topic,
      have_skill: values.have_skill,
      have_topic: values.have_topic,
      experiences: experiences as MentorProfileVO['experiences'],
    } as unknown as MentorProfileVO;

    await applyIdentityPatch(identityPatch, {
      primeProfileDto: () => {
        if (hasValidResolvedUserId) {
          primeUserProfileDtoCache(resolvedUserId, 'zh_TW', optimisticDto);
        }
      },
      updateSession: updateSessionIdentity,
    });

    return optimisticDto;
  }

  // Step 5: Immediate Navigation
  function step5ImmediateNavigation() {
    trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
    if (isMentorOnboarding) {
      navigate('/profile/card');
    } else {
      navigate(`/profile/${pageUserId}`);
    }
  }

  // Step 6: Background Prime & Reconcile
  function step6BackgroundReconcile(
    avatarUrl: string | undefined,
    jobTitle: string | undefined,
    company: string | undefined,
    identityPatch: IdentityPatch,
    updateSessionIdentity: (patch: IdentityPatch) => Promise<Session | null>
  ) {
    void (async () => {
      try {
        let latest: MentorProfileVO | null = null;
        if (sessionUserId) {
          latest = await fastSyncProfileRecord(
            sessionUserId,
            values,
            avatarUrl ?? '',
            fastFetchTimeoutMs,
            fetchProfilePort
          );
          if (latest) {
            primeUserProfileDtoCache(sessionUserId, 'zh_TW', latest);
          }
        }
        if (!latest && hasValidResolvedUserId) {
          const recordAdapter = new ProfileRecordAdapter(
            resolvedUserId,
            values,
            avatarUrl ?? '',
            fetchProfilePort
          );
          const { confirmed, latest: polled } = await runConvergence(
            recordAdapter,
            profileMaxRetries,
            profileIntervalMs
          );
          latest = polled;
          if (confirmed && polled) {
            primeUserProfileDtoCache(resolvedUserId, 'zh_TW', polled);
          }
        }

        await reconcileIdentityWithBackend(identityPatch, latest, {
          updateSession: updateSessionIdentity,
        });

        const isMentorRelevant =
          isMentorOnboarding ||
          Boolean(sessionUser?.isMentor) ||
          Boolean(latest?.is_mentor);

        const cardFields: MentorCardFields = {
          name: values.name,
          jobTitle: jobTitle ?? '',
          company: company ?? '',
          about: values.about ?? '',
          yearsOfExperience: String(values.years_of_experience ?? ''),
          haveTopic: values.have_topic ?? [],
          haveSkill: values.have_skill ?? [],
          avatar: avatarUrl ?? '',
        };

        await confirmProfileSynced(
          resolvedUserId,
          cardFields,
          isMentorRelevant,
          async () => {
            mentorPoolReadModel.clear();
            await revalidateProfilePath(pageUserId).catch((e: unknown) => {
              captureFlowFailure({
                flow: 'profile_update',
                step: 'post_sync_revalidate',
                message: e instanceof Error ? e.message : String(e),
                level: 'warning',
              });
            });
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
  const { payload } = await step2WriteProfile(avatarUrl);
  await step3InvalidateCachesAndRevalidate();

  const identityPatch = deriveOptimisticIdentityPatch({
    name: values.name,
    avatarUrl,
    isMentorOnboarding,
    fallbackAvatar: sessionUser?.avatar ?? currentDto?.avatar ?? values.avatar,
    fallbackIsMentor: sessionUser?.isMentor,
    fallbackOnBoarding: sessionUser?.onBoarding,
  });
  const updateSessionIdentity = buildSessionIdentityUpdater(
    payload.job_title,
    payload.company
  );

  const optimisticDto = await step4ApplyOptimisticIdentity(
    identityPatch,
    updateSessionIdentity,
    payload.job_title,
    payload.company,
    payload.experiences
  );
  step5ImmediateNavigation();
  step6BackgroundReconcile(
    avatarUrl,
    payload.job_title,
    payload.company,
    identityPatch,
    updateSessionIdentity
  );

  return optimisticDto;
}

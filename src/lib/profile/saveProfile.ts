import { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import {
  applyIdentityPatch,
  deriveOptimisticIdentityPatch,
  type IdentityPatch,
  reconcileIdentityWithBackend,
} from '@/lib/identity/identityProjection';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  confirmProfileSynced as defaultConfirmProfileSynced,
  firstSyncedFetch as defaultFirstSyncedFetch,
  MentorCardFields,
  pollUntilSynced as defaultPollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import {
  computeDirtyStates,
  extractValidLinks,
  mapFormValuesToPayload,
  type ProfileDirtyFields,
} from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import type { MentorProfileVO } from '@/types/user';

export class LoggedError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LoggedError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LoggedError);
    }
  }
}

export interface SaveProfileContext {
  pageUserId: string;
  isMentorOnboarding: boolean;
  dirtyFields?: ProfileDirtyFields;
}

export interface SaveProfileAdapters {
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  navigate: (path: string) => void;
  revalidateProfilePath: (id: string) => Promise<void>;
  clearUserDataCache: (userId: number, language: string) => void;
  primeUserDataCache: (
    userId: number,
    language: string,
    data: MentorProfileVO
  ) => void;
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
  firstSyncedFetch?: (
    userId: number,
    values: ProfileFormValues,
    avatar: string
  ) => Promise<MentorProfileVO | null>;
  pollUntilSynced?: (
    userId: number,
    values: ProfileFormValues,
    avatar: string
  ) => Promise<MentorProfileVO | null>;
  confirmProfileSynced?: (
    userId: number,
    fields: MentorCardFields,
    isMentorRelevant: boolean,
    revalidate: () => Promise<void>
  ) => Promise<void>;
  currentDto?: MentorProfileVO | null;
}

export interface SaveProfileDeps
  extends SaveProfileContext, SaveProfileAdapters {}

export async function saveProfile(
  values: ProfileFormValues,
  context: SaveProfileContext,
  adapters: SaveProfileAdapters
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  deps: SaveProfileDeps
): Promise<MentorProfileVO>;

export async function saveProfile(
  values: ProfileFormValues,
  contextOrDeps: SaveProfileContext | SaveProfileDeps,
  adapters?: SaveProfileAdapters
): Promise<MentorProfileVO> {
  let deps: SaveProfileDeps;
  if (adapters) {
    deps = {
      ...(contextOrDeps as SaveProfileContext),
      ...adapters,
    };
  } else {
    deps = contextOrDeps as SaveProfileDeps;
  }

  const {
    pageUserId,
    isMentorOnboarding,
    dirtyFields,
    session,
    updateSession,
    navigate,
    revalidateProfilePath,
    clearUserDataCache,
    primeUserDataCache,
    consumeAvatarUpload,
    firstSyncedFetch = defaultFirstSyncedFetch,
    pollUntilSynced = defaultPollUntilSynced,
    confirmProfileSynced = defaultConfirmProfileSynced,
    currentDto,
  } = deps;

  const sessionUserId = session?.user?.id ? Number(session.user.id) : null;
  const sessionUser = session?.user;

  // Step 1: Upload Avatar
  async function step1UploadAvatar(): Promise<string | undefined> {
    let avatarUrl = values.avatar;
    if (values.avatarFile) {
      try {
        const uploader = consumeAvatarUpload
          ? consumeAvatarUpload(values.avatarFile)
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
        await updateProfile(pageUserId, payload);
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

  // Step 3: Optimistic Cache Revalidation
  async function step3OptimisticCacheRevalidation() {
    if (sessionUserId) {
      clearUserDataCache(sessionUserId, 'zh_TW');
    }

    await revalidateProfilePath(pageUserId).catch((e) => {
      console.error('revalidateProfilePath failed:', e);
    });
  }

  // Step 4: Apply the optimistic identity patch (Ticket 670)
  //
  // The optimistic values for name/avatar/isMentor/onBoarding are derived
  // exactly once (`deriveOptimisticIdentityPatch`) and then applied to both
  // projection targets - the profile DTO cache and the NextAuth session -
  // through `applyIdentityPatch`, instead of each target recomputing its own
  // guess (Ticket 631 originally introduced the DTO cache half of this).
  //
  // `buildSessionIdentityUpdater` below is reused unchanged by step 6's
  // background reconciliation, so both the optimistic write and the
  // backend-confirmed correction go through the same session-merge code.
  function buildSessionIdentityUpdater(
    jobTitle: string | undefined,
    company: string | undefined
  ): (patch: IdentityPatch) => Promise<Session | null> {
    const personalLinks = extractValidLinks(values).map((link) => ({
      platform: link.platform,
      url: link.url,
    }));

    return (patch: IdentityPatch) =>
      updateSession({
        user: {
          id: sessionUser?.id,
          name: patch.name,
          avatar: patch.avatar,
          avatarUpdatedAt: values.avatarFile
            ? Date.now()
            : sessionUser?.avatarUpdatedAt,
          isMentor: patch.isMentor,
          onBoarding: patch.onBoarding,
          msg: sessionUser?.msg,
          personalLinks,
          jobTitle: jobTitle || sessionUser?.jobTitle,
          company: company || sessionUser?.company,
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

    const optimisticDto: MentorProfileVO = {
      ...currentDto,
      user_id: sessionUserId ?? Number(pageUserId),
      name: identityPatch.name,
      avatar: identityPatch.avatar,
      job_title: jobTitle || currentDto?.job_title || null,
      company: company || currentDto?.company || null,
      years_of_experience:
        values.years_of_experience || currentDto?.years_of_experience || null,
      location: values.location || currentDto?.location || null,
      personal_statement:
        values.statement || currentDto?.personal_statement || null,
      about: values.about || currentDto?.about || null,
      onboarding: identityPatch.onBoarding,
      is_mentor: identityPatch.isMentor,
      language: 'zh_TW',
      industry: values.industry
        ? {
            subject_group: values.industry,
            subject:
              currentDto?.industry && 'subject' in currentDto.industry
                ? ((currentDto.industry as Record<string, unknown>)
                    .subject as string)
                : '',
          }
        : (currentDto?.industry ?? null),
      want_position: values.want_position,
      want_skill: values.want_skill,
      want_topic: values.want_topic,
      have_skill: values.have_skill,
      have_topic: values.have_topic,
      experiences: experiences as MentorProfileVO['experiences'],
    } as unknown as MentorProfileVO;

    const resolvedUserId = sessionUserId ?? Number(pageUserId);

    await applyIdentityPatch(identityPatch, {
      primeProfileDto: () =>
        primeUserDataCache(resolvedUserId, 'zh_TW', optimisticDto),
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
          latest = await firstSyncedFetch(
            sessionUserId,
            values,
            avatarUrl ?? ''
          );
          if (latest) {
            primeUserDataCache(sessionUserId, 'zh_TW', latest);
          }
        }
        if (!latest) {
          latest = await pollUntilSynced(
            sessionUserId ?? Number(pageUserId),
            values,
            avatarUrl ?? ''
          );
        }

        // Reconcile the session against backend truth through the very same
        // `updateSessionIdentity` path step 4 used to apply the optimistic
        // patch, and covering every field that patch touched (not just
        // isMentor/onBoarding).
        await reconcileIdentityWithBackend(identityPatch, latest, {
          updateSession: updateSessionIdentity,
        });

        const isMentorRelevant =
          isMentorOnboarding ||
          Boolean(sessionUser?.isMentor) ||
          Boolean(latest?.is_mentor);
        await confirmProfileSynced(
          sessionUserId ?? Number(pageUserId),
          {
            name: values.name,
            jobTitle: jobTitle ?? '',
            company: company ?? '',
            about: values.about ?? '',
            yearsOfExperience: String(values.years_of_experience ?? ''),
            haveTopic: values.have_topic ?? [],
            avatar: avatarUrl ?? '',
          },
          isMentorRelevant,
          () =>
            revalidateProfilePath(pageUserId).catch((e: unknown) => {
              captureFlowFailure({
                flow: 'profile_update',
                step: 'post_sync_revalidate',
                message: e instanceof Error ? e.message : String(e),
                level: 'warning',
              });
            })
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
  await step3OptimisticCacheRevalidation();

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

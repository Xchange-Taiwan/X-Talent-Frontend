import { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { registerOptimisticAvatar } from '@/lib/profile/optimisticAvatar';
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
          : updateAvatar(values.avatarFile);
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

  // Step 4: Optimistic Cache Priming (Ticket 631)
  function step4OptimisticCachePriming(
    avatarUrl: string | undefined,
    jobTitle?: string,
    company?: string,
    experiencesPayload?: unknown
  ) {
    const optimisticIsMentor = isMentorOnboarding
      ? true
      : (sessionUser?.isMentor ?? false);
    const optimisticOnBoarding = isMentorOnboarding
      ? true
      : (sessionUser?.onBoarding ?? false);

    const experiences = experiencesPayload ?? currentDto?.experiences ?? null;

    const optimisticDto: MentorProfileVO = {
      ...currentDto,
      user_id: sessionUserId ?? Number(pageUserId),
      name: values.name,
      avatar: avatarUrl ?? currentDto?.avatar ?? values.avatar ?? null,
      job_title: jobTitle || currentDto?.job_title || null,
      company: company || currentDto?.company || null,
      years_of_experience:
        values.years_of_experience || currentDto?.years_of_experience || null,
      location: values.location || currentDto?.location || null,
      personal_statement:
        values.statement || currentDto?.personal_statement || null,
      about: values.about || currentDto?.about || null,
      onboarding: optimisticOnBoarding,
      is_mentor: optimisticIsMentor,
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
    primeUserDataCache(resolvedUserId, 'zh_TW', optimisticDto);
    registerOptimisticAvatar(resolvedUserId, optimisticDto.avatar);
    return optimisticDto;
  }

  // Step 5: Optimistic Session Update
  async function step5OptimisticSessionUpdate(
    avatarUrl: string | undefined,
    jobTitle?: string,
    company?: string
  ) {
    const personalLinks = extractValidLinks(values).map((link) => ({
      platform: link.platform,
      url: link.url,
    }));

    const optimisticIsMentor = isMentorOnboarding
      ? true
      : (sessionUser?.isMentor ?? false);
    const optimisticOnBoarding = isMentorOnboarding
      ? true
      : (sessionUser?.onBoarding ?? false);

    try {
      await updateSession({
        user: {
          id: sessionUser?.id,
          name: values.name ?? sessionUser?.name,
          avatar: avatarUrl ?? sessionUser?.avatar,
          avatarUpdatedAt: values.avatarFile
            ? Date.now()
            : sessionUser?.avatarUpdatedAt,
          isMentor: optimisticIsMentor,
          onBoarding: optimisticOnBoarding,
          msg: sessionUser?.msg,
          personalLinks,
          jobTitle: jobTitle || sessionUser?.jobTitle,
          company: company || sessionUser?.company,
        },
      });
    } catch (e) {
      console.error('updateSession failed:', e);
    }
    return { optimisticIsMentor, optimisticOnBoarding };
  }

  // Step 6: Immediate Navigation
  function step6ImmediateNavigation() {
    trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
    if (isMentorOnboarding) {
      navigate('/profile/card');
    } else {
      navigate(`/profile/${pageUserId}`);
    }
  }

  // Step 7: Background Prime & Reconcile
  function step7BackgroundReconcile(
    avatarUrl: string | undefined,
    jobTitle?: string,
    company?: string,
    optimisticIsMentor = false,
    optimisticOnBoarding = false
  ) {
    const reconcileSession = (latest: MentorProfileVO | null) => {
      if (!latest) return;
      const latestIsMentor = Boolean(latest.is_mentor);
      const latestOnBoarding = Boolean(latest.onboarding);
      if (
        optimisticIsMentor === latestIsMentor &&
        optimisticOnBoarding === latestOnBoarding
      ) {
        return;
      }
      void updateSession({
        user: {
          isMentor: latestIsMentor,
          onBoarding: latestOnBoarding,
        },
      });
    };

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
        reconcileSession(latest);

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

  // Enforce the execution order of the seven steps structurally
  const avatarUrl = await step1UploadAvatar();
  const { payload } = await step2WriteProfile(avatarUrl);
  await step3OptimisticCacheRevalidation();
  const optimisticDto = step4OptimisticCachePriming(
    avatarUrl,
    payload.job_title,
    payload.company,
    payload.experiences
  );
  const { optimisticIsMentor, optimisticOnBoarding } =
    await step5OptimisticSessionUpdate(
      avatarUrl,
      payload.job_title,
      payload.company
    );
  step6ImmediateNavigation();
  step7BackgroundReconcile(
    avatarUrl,
    payload.job_title,
    payload.company,
    optimisticIsMentor,
    optimisticOnBoarding
  );

  return optimisticDto;
}

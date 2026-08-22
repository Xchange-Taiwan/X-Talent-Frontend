import { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  confirmProfileSynced,
  firstSyncedFetch,
  pollUntilSynced,
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
}

export async function saveProfile(
  values: ProfileFormValues,
  context: SaveProfileContext,
  adapters: SaveProfileAdapters
): Promise<void> {
  const { pageUserId, isMentorOnboarding, dirtyFields } = context;
  const {
    session,
    updateSession,
    navigate,
    revalidateProfilePath,
    clearUserDataCache,
    primeUserDataCache,
    consumeAvatarUpload,
  } = adapters;

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

  // Step 4: Optimistic Avatar Override
  function step4OptimisticAvatarOverride(avatarUrl: string | undefined) {
    if (values.avatarFile && avatarUrl && sessionUser?.id) {
      setAvatarOverride(String(sessionUser.id), avatarUrl);
    }
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
            yearsOfExperience: values.years_of_experience,
            haveTopic: values.have_topic,
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
  step4OptimisticAvatarOverride(avatarUrl);
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
}

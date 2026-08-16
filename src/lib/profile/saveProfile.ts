import { Session } from 'next-auth';

import { trackEvent } from '@/lib/analytics';
import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  firstSyncedFetch as defaultFirstSyncedFetch,
  pollUntilMentorPoolSynced as defaultPollUntilMentorPoolSynced,
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

export interface SaveProfileDeps {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  dirtyFields?: ProfileDirtyFields;
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
  updateSession: (data: unknown) => Promise<Session | null>;
  navigate: (path: string) => void;
  revalidateProfilePath: (id: string) => Promise<void>;
  clearUserDataCache: (userId: number, language: string) => void;
  primeUserDataCache: (
    userId: number,
    language: string,
    data: MentorProfileVO
  ) => void;
  // Optional dependency injections to ease testing
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
  pollUntilMentorPoolSynced?: (
    userId: number,
    name: string,
    avatar: string
  ) => Promise<boolean>;
}

export async function saveProfile(
  values: ProfileFormValues,
  deps: SaveProfileDeps
): Promise<void> {
  const {
    pageUserId,
    isMentorOnboarding,
    session,
    dirtyFields,
    consumeAvatarUpload,
    updateSession,
    navigate,
    revalidateProfilePath,
    clearUserDataCache,
    primeUserDataCache,
    firstSyncedFetch = defaultFirstSyncedFetch,
    pollUntilSynced = defaultPollUntilSynced,
    pollUntilMentorPoolSynced = defaultPollUntilMentorPoolSynced,
  } = deps;

  // 1) avatar — consume background upload if wired, else upload now.
  let avatar = values.avatar;
  if (values.avatarFile) {
    try {
      const uploader = consumeAvatarUpload
        ? consumeAvatarUpload(values.avatarFile)
        : updateAvatar(values.avatarFile);
      const newUrl = await uploader;
      avatar = newUrl ?? avatar;
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

  // 2) profile + experience writes
  const { experiencesDirty, profileDirty } = computeDirtyStates(
    values,
    dirtyFields,
    isMentorOnboarding
  );

  const payload = mapFormValuesToPayload(values, avatar, experiencesDirty);
  const { job_title, company: companyFromPrimary } = payload;

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

  // 3) optimistic cache + navigation
  const sessionUserId = session?.user?.id ? Number(session.user.id) : null;
  const sessionUser = session?.user;
  const personalLinks = extractValidLinks(values).map((link) => ({
    platform: link.platform,
    url: link.url,
  }));

  if (sessionUserId) {
    clearUserDataCache(sessionUserId, 'zh_TW');
  }

  await revalidateProfilePath(pageUserId).catch((e) => {
    console.error('revalidateProfilePath failed:', e);
  });

  // 4) optimistic avatar override
  if (values.avatarFile && avatar && sessionUser?.id) {
    setAvatarOverride(String(sessionUser.id), avatar);
  }

  // 5) optimistic session update
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
        avatar: avatar ?? sessionUser?.avatar,
        avatarUpdatedAt: values.avatarFile
          ? Date.now()
          : sessionUser?.avatarUpdatedAt,
        isMentor: optimisticIsMentor,
        onBoarding: optimisticOnBoarding,
        msg: sessionUser?.msg,
        personalLinks,
        jobTitle: job_title || sessionUser?.jobTitle,
        company: companyFromPrimary || sessionUser?.company,
      },
    });
  } catch (e) {
    console.error('updateSession failed:', e);
  }

  // 6) navigate immediately — user no longer waits for backend sync.
  trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
  if (isMentorOnboarding) {
    navigate('/profile/card');
  } else {
    navigate(`/profile/${pageUserId}`);
  }

  // 7) background prime + reconcile
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
        latest = await firstSyncedFetch(sessionUserId, values, avatar ?? '');
        if (latest) {
          primeUserDataCache(sessionUserId, 'zh_TW', latest);
        }
      }
      if (!latest) {
        latest = await pollUntilSynced(
          sessionUserId ?? Number(pageUserId),
          values,
          avatar ?? ''
        );
      }
      reconcileSession(latest);

      // The immediate revalidateProfilePath call above (step 3) can race the
      // backend's own async (SQS-driven) update of the Elasticsearch index
      // /mentor-pool actually reads from, re-caching a stale card. `latest`
      // confirming the DB write synced (firstSyncedFetch/pollUntilSynced,
      // which read /v1/mentors/{id}/profile) is NOT sufficient proof of
      // that — the DB and the search index are updated by two different,
      // independently-lagging paths, so re-checking against the DB again
      // here would just repeat the same race. Poll the actual mentor-pool
      // listing query instead, then revalidate once it's confirmed synced.
      const isMentorRelevant =
        isMentorOnboarding ||
        Boolean(sessionUser?.isMentor) ||
        Boolean(latest?.is_mentor);
      if (isMentorRelevant) {
        const userIdForPoll = sessionUserId ?? Number(pageUserId);
        await pollUntilMentorPoolSynced(
          userIdForPoll,
          values.name,
          avatar ?? ''
        );
        await revalidateProfilePath(pageUserId).catch((e: unknown) => {
          captureFlowFailure({
            flow: 'profile_update',
            step: 'post_sync_revalidate',
            message: e instanceof Error ? e.message : String(e),
            level: 'warning',
          });
        });
      }
    } catch (e) {
      captureFlowFailure({
        flow: 'profile_update',
        step: 'background_reconcile',
        message: String(e),
      });
    }
  })();
}

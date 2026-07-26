import { Session } from 'next-auth';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import { captureFlowFailure } from '@/lib/monitoring';
import {
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
import { MentorProfileVO } from '@/services/profile/user';

export type { ProfileDirtyFields };

export type SaveProfileResult =
  | { ok: true; avatar?: string; warnings: string[] }
  | { ok: false; step: 'avatar_upload' | 'profile_write'; error: unknown };

export async function saveProfileWorkflow(
  values: ProfileFormValues,
  ctx: {
    pageUserId: string;
    isMentorOnboarding: boolean;
    session: Session | null;
    dirtyFields?: ProfileDirtyFields;
  },
  deps: {
    updateSession: (data: unknown) => Promise<Session | null>;
    consumeAvatarUpload?: (
      file: File | undefined
    ) => Promise<string | undefined>;
  }
): Promise<SaveProfileResult> {
  // 1) avatar — consume background upload if wired, else upload now.
  let avatar = values.avatar;
  if (values.avatarFile) {
    try {
      const uploader = deps.consumeAvatarUpload
        ? deps.consumeAvatarUpload(values.avatarFile)
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
      return { ok: false, step: 'avatar_upload', error: err };
    }
  }

  // 2) profile + experience writes
  const { experiencesDirty, profileDirty } = computeDirtyStates(
    values,
    ctx.dirtyFields,
    ctx.isMentorOnboarding
  );

  const payload = mapFormValuesToPayload(values, avatar, experiencesDirty);
  const { job_title, company: companyFromPrimary } = payload;

  try {
    if (profileDirty) {
      await updateProfile(payload);
    }
  } catch (err) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'profile_write',
      message: err instanceof Error ? err.message : 'Profile write failed',
    });
    return { ok: false, step: 'profile_write', error: err };
  }

  // 3) optimistic cache + navigation (soft failures)
  const warnings: string[] = [];
  const sessionUserId = ctx.session?.user?.id
    ? Number(ctx.session.user.id)
    : null;
  const sessionUser = ctx.session?.user;
  const personalLinks = extractValidLinks(values).map((link) => ({
    platform: link.platform,
    url: link.url,
  }));

  if (sessionUserId) {
    try {
      clearUserDataCache(sessionUserId, 'zh_TW');
    } catch (err) {
      console.error('clearUserDataCache failed:', err);
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    await revalidateProfilePath(ctx.pageUserId);
  } catch (err) {
    console.error('revalidateProfilePath failed:', err);
    warnings.push(err instanceof Error ? err.message : String(err));
  }

  // 4) optimistic avatar override (soft failure)
  if (values.avatarFile && avatar && sessionUser?.id) {
    try {
      setAvatarOverride(String(sessionUser.id), avatar);
    } catch (err) {
      console.error('setAvatarOverride failed:', err);
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 5) optimistic session update (soft failure)
  const optimisticIsMentor = ctx.isMentorOnboarding
    ? true
    : (sessionUser?.isMentor ?? false);
  const optimisticOnBoarding = ctx.isMentorOnboarding
    ? true
    : (sessionUser?.onBoarding ?? false);

  try {
    await deps.updateSession({
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
  } catch (err) {
    console.error('updateSession failed:', err);
    warnings.push(err instanceof Error ? err.message : String(err));
  }

  // 7) background prime + reconcile (runs in background, errors caught inside)
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
    void deps.updateSession({
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
        latest = await firstSyncedFetch(values, avatar ?? '');
        if (latest) {
          primeUserDataCache(sessionUserId, 'zh_TW', latest);
        }
      }
      if (!latest) {
        latest = await pollUntilSynced(values, avatar ?? '');
      }
      reconcileSession(latest);
    } catch (err) {
      console.error('Background cache prime / reconcile failed:', err);
    }
  })();

  return { ok: true, avatar, warnings };
}

'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
import { useToast } from '@/components/ui/use-toast';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
import { setAvatarOverride } from '@/lib/avatar/avatarOverrideStore';
import { captureFlowFailure } from '@/lib/monitoring';
import { encode } from '@/lib/profile/experienceCodec';
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { MentorProfileVO } from '@/services/profile/user';

// RHF's dirtyFields is a deep partial where leaves are `true`. Nested fields
// (objects, arrays) carry the same shape, so we recurse to detect "anything
// dirty inside" without enumerating every leaf.
export type ProfileDirtyFields = Partial<
  Record<keyof ProfileFormValues, unknown>
>;

function hasDirtyValue(v: unknown): boolean {
  if (!v) return false;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.some(hasDirtyValue);
  if (typeof v === 'object') return Object.values(v).some(hasDirtyValue);
  return Boolean(v);
}

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  jobSectionError: boolean;
  educationSectionError: boolean;
  onScrollToError?: (fieldId: string) => void;
  // Optional: lets the page hand back an already-in-flight S3 upload (kicked
  // off when the user picked the file) so submit doesn't pay the round trip.
  // Falls back to a direct upload when omitted, preserving legacy callers.
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  jobSectionError,
  educationSectionError,
  onScrollToError,
  consumeAvatarUpload,
}: Options) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (
    values: ProfileFormValues,
    dirtyFields?: ProfileDirtyFields
  ) => {
    if (jobSectionError || educationSectionError) {
      onScrollToError?.(jobSectionError ? 'work_experiences' : 'educations');
      return;
    }

    try {
      setIsSaving(true);

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
            message:
              err instanceof Error ? err.message : 'Avatar upload failed',
            level: 'warning',
          });
          throw err;
        }
      }

      // 2) profile + experience writes — experiences ride inline on the
      //    profile PUT (backend stores them as JSONB[] on profiles.experiences).
      //    When `dirtyFields` is omitted we fall back to the legacy
      //    "send everything" behaviour so existing callers and tests are
      //    unaffected.
      const isDirty = (key: keyof ProfileFormValues): boolean => {
        if (!dirtyFields) return true;
        return hasDirtyValue(dirtyFields[key]);
      };

      const workDirty = isDirty('work_experiences');
      const educationDirty = isDirty('educations');
      const linksDirty =
        isDirty('linkedin') ||
        isDirty('facebook') ||
        isDirty('instagram') ||
        isDirty('twitter') ||
        isDirty('youtube') ||
        isDirty('website');
      const experiencesDirty = workDirty || educationDirty || linksDirty;

      // updateProfile sends every form field, so any non-experience profile
      // edit triggers it. `isMentorOnboarding` forces it through so the
      // backend onboarding flag flips even when the user submits without
      // touching anything. A new avatar file also counts. Any dirty
      // experience section also triggers it because experiences travel inline.
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

      const links = [
        values.linkedin,
        values.facebook,
        values.instagram,
        values.twitter,
        values.youtube,
        values.website,
      ].filter((l) => l && l.url);

      // The codec derives both the wire-format experiences batch and the
      // top-level job_title/company mirror (which consumers like the
      // profile page, mentor pool card, and reservations read directly
      // without re-deriving from the experience list) from the same form
      // values — see experienceCodec.ts.
      const {
        experiences,
        job_title,
        company: companyFromPrimary,
      } = encode({
        workExperiences: values.work_experiences ?? [],
        educations: values.educations ?? [],
        personalLinks: links,
      });

      const payload = {
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
        throw err;
      }

      // 3) optimistic cache + navigation — clear the local cache so the next
      //    page fetches fresh, then navigate immediately. The fast first-sync
      //    fetch + cache prime now runs in the background (step 6) instead of
      //    blocking the user behind a ~800ms timeout.
      const sessionUserId = session?.user?.id ? Number(session.user.id) : null;
      const sessionUser = session?.user;
      const personalLinks = links.map((link) => ({
        platform: link.platform,
        url: link.url,
      }));

      if (sessionUserId) {
        clearUserDataCache(sessionUserId, 'zh_TW');
      }

      // Invalidate the SSR ISR cache for /profile/[userId] so other
      // visitors (and the editor on navigation) don't see up-to-60s-stale
      // server-rendered HTML. Awaited (not fire-and-forget) so the cache
      // is marked stale BEFORE we router.push — otherwise the next-page
      // SSR fires while the cache is still fresh and serves the old
      // avatar in the first paint. .catch keeps a server-action failure
      // from breaking submit.
      await revalidateProfilePath(pageUserId).catch((e) => {
        console.error('revalidateProfilePath failed:', e);
      });

      // 4) optimistic avatar override — NextAuth's update() is async (POST
      //    + GET round trip), so the header would otherwise show the old
      //    avatar until the round trip lands. Setting the override here is
      //    synchronous, so consumers reading useCurrentAvatar() see the new
      //    URL on the very next render. The override clears itself once
      //    session.user.avatar catches up.
      if (values.avatarFile && avatar && sessionUser?.id) {
        setAvatarOverride(String(sessionUser.id), avatar);
      }

      // 5) optimistic session update — for the mentor onboarding flow we
      //    know the user is becoming a mentor, so flip role/onboarding to
      //    true immediately. Otherwise keep them from the current session
      //    to avoid flickering mentor → mentee while the backend catches
      //    up. The reconcile in step 7 corrects them if the backend
      //    disagrees.
      //    Awaited (not fire-and-forget) so the JWT cookie holds the new
      //    avatar before we router.push. Otherwise the next page's SSR
      //    getServerSession reads the old JWT, seeds SessionProvider
      //    with the old avatar, and the header renders the old image
      //    until the client-side update finally lands. Wrapped in
      //    try/catch so a session-refresh failure doesn't surface as
      //    "儲存失敗" — the override + step-7 reconcile heal client
      //    state regardless.
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
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }

      // 7) background prime + reconcile — try the fast first-sync read; if
      //    the backend has already caught up, prime the cache so subsequent
      //    reads on the next page are instant. Otherwise fall back to the
      //    longer pollUntilSynced. Either way, reconcile the session if the
      //    backend reports a different is_mentor / onboarding than the
      //    optimistic value.
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
        // Send only the fields we're correcting. Spreading `sessionUser`
        // here would overwrite step-4's just-updated avatar with the
        // pre-submit URL captured at the top of onSubmit, snapping the
        // header / profile page back to the old avatar a few seconds
        // after navigation. NextAuth's JWT callback shallow-merges, so
        // omitted fields retain their current token value.
        void updateSession({
          user: {
            isMentor: latestIsMentor,
            onBoarding: latestOnBoarding,
          },
        });
      };

      void (async () => {
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
      })();
    } catch (err) {
      captureFlowFailure({
        flow: 'profile_update',
        step: 'unexpected',
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected profile update error',
      });
      console.error('Update Profile Error:', err);
      toast({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試',
        duration: 5000,
      });
      setIsSaving(false);
    }
  };

  return { onSubmit, isSaving };
}

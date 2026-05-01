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
import {
  firstSyncedFetch,
  pollUntilSynced,
} from '@/lib/profile/pollUntilSynced';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { upsertMentorExperience } from '@/services/profile/upsertExperience';
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
          });
          throw err;
        }
      }

      // 2) profile + experience writes — fire only the PUTs whose section
      //    actually changed. When `dirtyFields` is omitted we fall back to
      //    the legacy "send everything" behaviour so existing callers and
      //    tests are unaffected.
      //
      //    Backend tables are independent (Profile vs MentorExperience, no
      //    FK, no shared rows; is_mentor flag is only written by the profile
      //    endpoint), so concurrent merges don't race.
      const isDirty = (key: keyof ProfileFormValues): boolean => {
        if (!dirtyFields) return true;
        return hasDirtyValue(dirtyFields[key]);
      };

      // updateProfile sends every form field, so any non-experience profile
      // edit triggers it. `isMentorOnboarding` forces it through so the
      // backend onboarding flag flips even when the user submits without
      // touching anything. A new avatar file also counts.
      // `work_experiences` is included so toggling `isPrimary` (or editing
      // the primary entry's job/company) re-syncs `mentor.job_title` /
      // `mentor.company`, which are derived from the primary entry below.
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
        isDirty('expertises') ||
        isDirty('interested_positions') ||
        isDirty('skills') ||
        isDirty('topics') ||
        isDirty('what_i_offer') ||
        isDirty('work_experiences');

      const workDirty = isDirty('work_experiences');
      const educationDirty = isDirty('educations');
      const linksDirty =
        isDirty('linkedin') ||
        isDirty('facebook') ||
        isDirty('instagram') ||
        isDirty('twitter') ||
        isDirty('youtube') ||
        isDirty('website');
      const whatIOfferDirty = isDirty('what_i_offer');

      // Mentor's top-level job_title / company mirror the primary work
      // experience so consumers (profile page, mentor pool card, reservations)
      // can read them directly from the mentor record without re-deriving
      // from the experience list. Falls back to the first entry when no
      // primary is flagged, matching the JobExperienceSection UI invariant.
      const primaryWork =
        values.work_experiences?.find((w) => w.isPrimary) ??
        values.work_experiences?.[0];
      const job_title = primaryWork?.job ?? '';
      const companyFromPrimary = primaryWork?.company ?? '';

      const payload = {
        ...values,
        avatar,
        avatarFile: undefined,
        job_title,
        company: companyFromPrimary,
      };
      const links = [
        values.linkedin,
        values.facebook,
        values.instagram,
        values.twitter,
        values.youtube,
        values.website,
      ].filter((l) => l && l.url);

      try {
        await Promise.all([
          profileDirty ? updateProfile(payload) : Promise.resolve(),

          workDirty && values.work_experiences?.length > 0
            ? upsertMentorExperience(ExperienceType.WORK, true, {
                id: 1,
                category: ExperienceType.WORK,
                mentor_experiences_metadata: {
                  data: values.work_experiences.map((item) => ({
                    job: item.job,
                    company: item.company,
                    jobPeriodStart: item.jobPeriodStart,
                    jobPeriodEnd: item.jobPeriodEnd,
                    industry: item.industry,
                    jobLocation: item.jobLocation,
                    description: item.description,
                    isPrimary: item.isPrimary ?? false,
                  })),
                },
                order: 1,
              })
            : Promise.resolve(),

          educationDirty && values.educations?.length > 0
            ? upsertMentorExperience(ExperienceType.EDUCATION, true, {
                id: 2,
                category: ExperienceType.EDUCATION,
                mentor_experiences_metadata: {
                  data: values.educations.map((item) => ({
                    school: item.school,
                    subject: item.subject,
                    educationPeriodStart: item.educationPeriodStart,
                    educationPeriodEnd: item.educationPeriodEnd,
                  })),
                },
                order: 2,
              })
            : Promise.resolve(),

          linksDirty && links.length > 0
            ? upsertMentorExperience(ExperienceType.LINK, true, {
                id: 3,
                category: ExperienceType.LINK,
                mentor_experiences_metadata: {
                  data: links.map((link) => ({
                    platform: link.platform,
                    url: link.url,
                  })),
                },
                order: 3,
              })
            : Promise.resolve(),

          whatIOfferDirty && values.what_i_offer?.length > 0
            ? upsertMentorExperience(ExperienceType.WHAT_I_OFFER, true, {
                id: 4,
                category: ExperienceType.WHAT_I_OFFER,
                mentor_experiences_metadata: {
                  data: values.what_i_offer.map((item) => ({
                    subject_group: item,
                  })),
                },
                order: 4,
              })
            : Promise.resolve(),
        ]);
      } catch (err) {
        captureFlowFailure({
          flow: 'profile_update',
          step: 'parallel_write',
          message:
            err instanceof Error
              ? err.message
              : 'Profile parallel write failed',
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
      // server-rendered HTML. Fire-and-forget — never block navigation on
      // a failed revalidation.
      void revalidateProfilePath(pageUserId).catch((e) => {
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

      // 5) optimistic session update — keep role/onboarding from current
      //    session so we never flicker mentor → mentee while the backend
      //    catches up. The reconcile in step 7 corrects them if the user
      //    actually transitioned during this submit.
      //    Fire-and-forget: navigation no longer waits for NextAuth's
      //    /api/auth/session round trip. The avatar override above keeps
      //    the header in sync until the JWT update lands.
      void updateSession({
        user: {
          id: sessionUser?.id,
          name: values.name ?? sessionUser?.name,
          avatar: avatar ?? sessionUser?.avatar,
          avatarUpdatedAt: values.avatarFile
            ? Date.now()
            : sessionUser?.avatarUpdatedAt,
          isMentor: sessionUser?.isMentor,
          onBoarding: sessionUser?.onBoarding,
          msg: sessionUser?.msg,
          personalLinks,
        },
      });

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
        const optimisticIsMentor = sessionUser?.isMentor ?? false;
        const optimisticOnBoarding = sessionUser?.onBoarding ?? false;
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

'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { trackEvent } from '@/lib/analytics';
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
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (values: ProfileFormValues) => {
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

      // 2) profile + experience writes — fire all five PUTs in parallel.
      //    Backend tables are independent (Profile vs MentorExperience, no
      //    FK, no shared rows; is_mentor flag is only written by the profile
      //    endpoint), so concurrent merges don't race. See backend audit in
      //    PR description.
      const payload = { ...values, avatar, avatarFile: undefined };
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
          updateProfile(payload),

          values.work_experiences?.length > 0
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

          values.educations?.length > 0
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

          links.length > 0
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

          values.what_i_offer?.length > 0
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

      // 3) prime user-data cache before navigation — bounded by a short
      //    timeout. If the backend has already synced (the common case
      //    once step 2 returned), the next page mount renders from
      //    cache with zero API calls. Otherwise we fall back to the
      //    historical clear-cache + background-poll path so the user is
      //    never blocked on backend latency.
      const sessionUserId = session?.user?.id ? Number(session.user.id) : null;
      const sessionUser = session?.user;
      const personalLinks = links.map((link) => ({
        platform: link.platform,
        url: link.url,
      }));

      let primedLatest: MentorProfileVO | null = null;
      if (sessionUserId) {
        primedLatest = await firstSyncedFetch(values, avatar ?? '');
        if (primedLatest) {
          primeUserDataCache(sessionUserId, 'zh_TW', primedLatest);
        } else {
          clearUserDataCache(sessionUserId, 'zh_TW');
        }
      }

      // Invalidate the SSR ISR cache for /profile/[userId] so other
      // visitors (and the editor on navigation) don't see up-to-60s-stale
      // server-rendered HTML. Fire-and-forget — never block navigation on
      // a failed revalidation.
      void revalidateProfilePath(pageUserId).catch((e) => {
        console.error('revalidateProfilePath failed:', e);
      });

      // 4) optimistic session update — keep role/onboarding from current
      //    session so we never flicker mentor → mentee while the backend
      //    catches up. The reconcile in step 6 corrects them if the user
      //    actually transitioned during this submit.
      //    Fire-and-forget: navigation no longer waits for NextAuth's
      //    /api/auth/session round trip. The optimistic data is already
      //    in the call args, so the JWT update lands before the next
      //    render.
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

      // 5) navigate immediately — user no longer waits for backend sync
      trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }

      // 6) session reconcile — if the backend ultimately reports a
      //    different is_mentor / onboarding than the optimistic value,
      //    patch the session. Reuses the primed result when available so
      //    we do not double-poll; otherwise falls back to the background
      //    pollUntilSynced for slow-sync cases.
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
        void updateSession({
          user: {
            ...sessionUser,
            isMentor: latestIsMentor,
            onBoarding: latestOnBoarding,
          },
        });
      };

      if (primedLatest) {
        reconcileSession(primedLatest);
      } else {
        void pollUntilSynced(values, avatar ?? '').then(reconcileSession);
      }
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
      setIsSaving(false);
    }
  };

  return { onSubmit, isSaving };
}

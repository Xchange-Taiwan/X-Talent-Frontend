'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

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
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  jobSectionError,
  educationSectionError,
  onScrollToError,
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

      // 1) avatar upload (if any)
      let avatar = values.avatar;
      if (values.avatarFile) {
        try {
          const newUrl = await updateAvatar(values.avatarFile);
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

      // 2) profile update
      const payload = { ...values, avatar, avatarFile: undefined };
      try {
        await updateProfile(payload);
      } catch (err) {
        captureFlowFailure({
          flow: 'profile_update',
          step: 'update_profile',
          message: err instanceof Error ? err.message : 'Profile update failed',
        });
        throw err;
      }

      // 3) upsert experiences in parallel
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
          step: 'upsert_experience',
          message:
            err instanceof Error ? err.message : 'Experience upsert failed',
        });
        throw err;
      }

      // 4) prime user-data cache before navigation — bounded by a short
      //    timeout. If the backend has already synced (the common case
      //    once steps 1-3 returned), the next page mount renders from
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

      // 5) optimistic session update — keep role/onboarding from current
      //    session so we never flicker mentor → mentee while the backend
      //    catches up. The reconcile in step 7 corrects them if the user
      //    actually transitioned during this submit.
      await updateSession({
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

      // 6) navigate immediately — user no longer waits for backend sync
      trackEvent({ name: 'profile_update_submitted', feature: 'profile' });
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }

      // 7) session reconcile — if the backend ultimately reports a
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

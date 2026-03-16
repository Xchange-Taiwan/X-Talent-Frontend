'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
import { clearUserDataCache } from '@/hooks/user/user-data/useUserData';
import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilSynced } from '@/lib/profile/pollUntilSynced';
import { ExperienceType } from '@/services/profile/experienceType';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { upsertMentorExperience } from '@/services/profile/upsertExperience';

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  jobSectionError: boolean;
  educationSectionError: boolean;
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  jobSectionError,
  educationSectionError,
}: Options) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (values: ProfileFormValues) => {
    if (jobSectionError || educationSectionError) return;

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

      // 4) poll until backend reflects all updated fields (up to 1 min, every 5s)
      const latest = await pollUntilSynced(values, avatar ?? '');

      // 5) invalidate in-memory user data cache so the profile page fetches
      //    fresh data on next mount instead of a potentially stale promise
      if (session?.user?.id) {
        clearUserDataCache(Number(session.user.id), 'zh_TW');
      }

      // 6) update next-auth session (requires jwt trigger update handler!)
      await updateSession({
        user: {
          // keep id from current session
          id: session?.user?.id,
          name: latest?.name ?? values.name ?? session?.user?.name,
          avatar: latest?.avatar ?? avatar ?? session?.user?.avatar,
          avatarUpdatedAt: values.avatarFile
            ? Date.now()
            : session?.user?.avatarUpdatedAt,
          isMentor: Boolean(latest?.is_mentor),
          onBoarding: Boolean(latest?.onboarding),
          msg: session?.user?.msg,
        },
      });

      // 7) navigate
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
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

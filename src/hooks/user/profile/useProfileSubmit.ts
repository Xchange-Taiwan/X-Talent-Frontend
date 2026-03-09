'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useState } from 'react';

import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
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
        const newUrl = await updateAvatar(values.avatarFile);
        avatar = newUrl ?? avatar;
      }

      // 2) profile update
      const payload = { ...values, avatar, avatarFile: undefined };
      await updateProfile(payload);

      // 3) upsert experiences (keep your original logic)
      if (values.work_experiences?.length > 0) {
        await upsertMentorExperience(ExperienceType.WORK, true, {
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
        });
      }

      if (values.educations?.length > 0) {
        await upsertMentorExperience(ExperienceType.EDUCATION, true, {
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
        });
      }

      const links = [
        values.linkedin,
        values.facebook,
        values.instagram,
        values.twitter,
        values.youtube,
        values.website,
      ].filter((l) => l && l.url);

      if (links.length > 0) {
        await upsertMentorExperience(ExperienceType.LINK, true, {
          id: 3,
          category: ExperienceType.LINK,
          mentor_experiences_metadata: {
            data: links.map((link) => ({
              platform: link.platform,
              url: link.url,
            })),
          },
          order: 3,
        });
      }

      if (values.what_i_offer?.length > 0) {
        await upsertMentorExperience(ExperienceType.WHAT_I_OFFER, true, {
          id: 4,
          category: ExperienceType.WHAT_I_OFFER,
          mentor_experiences_metadata: {
            data: values.what_i_offer.map((item) => ({
              subject_group: item,
            })),
          },
          order: 4,
        });
      }

      // 4) poll until backend reflects all updated fields (up to 1 min, every 5s)
      const latest = await pollUntilSynced(values, avatar);

      // 5) update next-auth session (requires jwt trigger update handler!)
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

      // 6) navigate
      if (isMentorOnboarding) {
        router.push('/profile/card');
      } else {
        router.push(`/profile/${pageUserId}`);
      }
    } catch (err) {
      console.error('Update Profile Error:', err);
      setIsSaving(false);
    }
  };

  return { onSubmit, isSaving };
}

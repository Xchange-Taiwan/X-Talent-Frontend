'use client';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';

import {
  defaultValues,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import {
  parseEducations,
  parseLinks,
  parseWhatIOffer,
  parseWorkExperiences,
} from '@/lib/profile/parseUserExperiences';
import { MentorExperiencePayload } from '@/services/profile/upsertExperience';
import { fetchUser } from '@/services/profile/user';

interface Options {
  form: UseFormReturn<ProfileFormValues>;
  isAuthorized: boolean;
  isMentorOnboarding: boolean;
  setIsMentor: (v: boolean) => void;
  setIsPageLoading: (v: boolean) => void;
}

export function useEditProfileData({
  form,
  isAuthorized,
  isMentorOnboarding,
  setIsMentor,
  setIsPageLoading,
}: Options) {
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    async function fetchUserData() {
      try {
        const data = await fetchUser('zh_TW');
        if (!data || cancelled) return;

        const mentorFlag = Boolean(data.is_mentor || isMentorOnboarding);
        const experiences =
          data.experiences as unknown as MentorExperiencePayload[];

        const parsedExperiences = parseWorkExperiences(experiences);
        const parsedEducations = parseEducations(experiences);
        const parsedLinks = parseLinks(experiences);

        form.reset({
          is_mentor: mentorFlag,
          avatar: data.avatar || '',
          avatarFile: undefined,
          name: data.name || '',
          location: data.location || '',
          statement: data.personal_statement || '',
          about: data.about || '',
          industry: data.industry?.subject_group || '',
          years_of_experience: data.years_of_experience || '',
          linkedin: parsedLinks.linkedin || defaultValues.linkedin,
          facebook: parsedLinks.facebook || defaultValues.facebook,
          instagram: parsedLinks.instagram || defaultValues.instagram,
          twitter: parsedLinks.twitter || defaultValues.twitter,
          youtube: parsedLinks.youtube || defaultValues.youtube,
          website: parsedLinks.website || defaultValues.website,
          work_experiences: parsedExperiences || defaultValues.work_experiences,
          educations: parsedEducations || defaultValues.educations,
        });

        form.setValue(
          'expertises',
          data.expertises?.professions?.map((i) => i.subject_group) || []
        );
        form.setValue(
          'interested_positions',
          data.interested_positions?.interests?.map((i) => i.subject_group) ||
            []
        );
        form.setValue(
          'skills',
          data.skills?.interests?.map((i) => i.subject_group) || []
        );
        form.setValue(
          'topics',
          data.topics?.interests?.map((i) => i.subject_group) || []
        );
        form.setValue('what_i_offer', parseWhatIOffer(experiences));

        setIsMentor(mentorFlag);
        setIsPageLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch user data:', err);
          setIsPageLoading(false);
        }
      }
    }

    fetchUserData();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, isMentorOnboarding]);
}

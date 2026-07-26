'use client';
import { useEffect, useLayoutEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import {
  MentorExperiencePayload,
  toFormValues,
} from '@/lib/profile/parseUserExperiences';
import { readIndustryTag } from '@/lib/profile/readIndustryTag';
import { defaultValues, ProfileFormValues } from '@/schemas/profileSchema';

interface Options {
  userId: number;
  form: UseFormReturn<ProfileFormValues>;
  isAuthorized: boolean;
  isMentorOnboarding: boolean;
  setIsMentor: (v: boolean) => void;
  setIsPageLoading: (v: boolean) => void;
}

export function useEditProfileData({
  userId,
  form,
  isAuthorized,
  isMentorOnboarding,
  setIsMentor,
  setIsPageLoading,
}: Options) {
  // Fire the user fetch in parallel with auth resolution. The form.reset
  // effect below still gates on `isAuthorized`, so unauthorized callers
  // (redirected by useProfileAuth) never see the data populated.
  const { userDto, error } = useUserProfileDto(userId, 'zh_TW');

  // useLayoutEffect (not useEffect) so form.reset + setIsPageLoading(false)
  // commit before the browser paints. When the dto is already cached at mount
  // (the common profile → edit nav), this skips the one-frame `<PageLoading />`
  // spinner that otherwise paints between the initial render and the effect.
  useLayoutEffect(() => {
    if (!isAuthorized || !userDto) return;

    const mentorFlag = Boolean(userDto.is_mentor || isMentorOnboarding);
    const experiences =
      userDto.experiences as unknown as MentorExperiencePayload[];

    const {
      workExperiences: parsedExperiences,
      educations: parsedEducations,
      links: parsedLinks,
    } = toFormValues(experiences);

    // BFF returns industry enriched as a TagVO-shaped object; the OpenAPI
    // generator types it as `Record<string, never>` because the BFF model
    // declares it as `Optional[Dict[str, Any]]`.
    const industryTag = readIndustryTag(userDto.industry);
    const industrySg = industryTag?.subject_group ?? '';

    // Reset must include every server-driven field so RHF treats them as the
    // new defaults; otherwise dirtyFields starts non-empty and submit-time
    // skip optimisations cannot tell what the user actually changed.
    form.reset({
      is_mentor: mentorFlag,
      avatar: userDto.avatar || '',
      avatarFile: undefined,
      name: userDto.name || '',
      location: userDto.location || '',
      statement: userDto.personal_statement || '',
      about: userDto.about || '',
      industry: industrySg,
      years_of_experience: userDto.years_of_experience || '',
      work_experiences: parsedExperiences || defaultValues.work_experiences,
      educations: parsedEducations || defaultValues.educations,
      linkedin: parsedLinks.linkedin || defaultValues.linkedin,
      facebook: parsedLinks.facebook || defaultValues.facebook,
      instagram: parsedLinks.instagram || defaultValues.instagram,
      twitter: parsedLinks.twitter || defaultValues.twitter,
      youtube: parsedLinks.youtube || defaultValues.youtube,
      website: parsedLinks.website || defaultValues.website,
      have_topic: userDto.have_topic ?? [],
      have_skill: userDto.have_skill ?? [],
      want_position: userDto.want_position ?? [],
      want_skill: userDto.want_skill ?? [],
      want_topic: userDto.want_topic ?? [],
    });

    setIsMentor(mentorFlag);
    setIsPageLoading(false);
  }, [
    userDto,
    isAuthorized,
    isMentorOnboarding,
    form,
    setIsMentor,
    setIsPageLoading,
  ]);

  useEffect(() => {
    if (!error) return;
    console.error('Failed to fetch user data:', error);
    setIsPageLoading(false);
  }, [error, setIsPageLoading]);
}

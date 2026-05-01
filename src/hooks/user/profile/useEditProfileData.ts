'use client';
import { useEffect, useLayoutEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';

import {
  defaultValues,
  ProfileFormValues,
} from '@/components/profile/edit/profileSchema';
import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { useUserTags } from '@/hooks/userTags/useUserTags';
import {
  parseEducations,
  parseLinks,
  parseWhatIOffer,
  parseWorkExperiences,
} from '@/lib/profile/parseUserExperiences';
import { MentorExperiencePayload } from '@/services/profile/upsertExperience';

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

  // #229: WHAT_I_OFFER lives in user_tags(kind=what_i_offer, intent=OFFER)
  // now. Fetch alongside the profile dto; when the response is empty we
  // fall back to parseWhatIOffer so users with legacy mentor_experiences
  // data still see their values until they re-save.
  const { tags: whatIOfferTags, isLoading: whatIOfferTagsLoading } =
    useUserTags({
      userId,
      kind: 'what_i_offer',
      intent: 'OFFER',
      enabled: isAuthorized && Boolean(userId),
    });

  // useLayoutEffect (not useEffect) so form.reset + setIsPageLoading(false)
  // commit before the browser paints. When the dto is already cached at mount
  // (the common profile → edit nav), this skips the one-frame `<PageLoading />`
  // spinner that otherwise paints between the initial render and the effect.
  useLayoutEffect(() => {
    if (!isAuthorized || !userDto || whatIOfferTagsLoading) return;

    const mentorFlag = Boolean(userDto.is_mentor || isMentorOnboarding);
    const experiences =
      userDto.experiences as unknown as MentorExperiencePayload[];

    const parsedExperiences = parseWorkExperiences(experiences);
    const parsedEducations = parseEducations(experiences);
    const parsedLinks = parseLinks(experiences);

    const whatIOfferFromTags = whatIOfferTags
      .map((t) => t.subject_group)
      .filter((g): g is string => Boolean(g));
    const whatIOfferFromLegacy = parseWhatIOffer(experiences);
    const whatIOfferValues =
      whatIOfferFromTags.length > 0 ? whatIOfferFromTags : whatIOfferFromLegacy;

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
      industry: userDto.industry?.subject_group
        ? [userDto.industry.subject_group]
        : [],
      years_of_experience: userDto.years_of_experience || '',
      work_experiences: parsedExperiences || defaultValues.work_experiences,
      educations: parsedEducations || defaultValues.educations,
      linkedin: parsedLinks.linkedin || defaultValues.linkedin,
      facebook: parsedLinks.facebook || defaultValues.facebook,
      instagram: parsedLinks.instagram || defaultValues.instagram,
      twitter: parsedLinks.twitter || defaultValues.twitter,
      youtube: parsedLinks.youtube || defaultValues.youtube,
      website: parsedLinks.website || defaultValues.website,
      what_i_offer: whatIOfferValues,
      expertises:
        userDto.expertises?.professions?.map((i) => i.subject_group) || [],
      interested_positions:
        userDto.interested_positions?.interests?.map((i) => i.subject_group) ||
        [],
      skills: userDto.skills?.interests?.map((i) => i.subject_group) || [],
      topics: userDto.topics?.interests?.map((i) => i.subject_group) || [],
    });

    setIsMentor(mentorFlag);
    setIsPageLoading(false);
  }, [
    userDto,
    whatIOfferTags,
    whatIOfferTagsLoading,
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

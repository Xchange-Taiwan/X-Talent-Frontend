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

  // #229–#232: every per-kind picker (what_i_offer / skill / topic /
  // position / expertise) is now backed by user_tags. Fetch the full
  // per-user tag list once and group client-side rather than running
  // one request per (kind, intent) pair. Empty groups fall back to
  // legacy JSONB / mentor_experiences so users who haven't re-saved
  // on the new path still see their values during transition.
  const { tags: allUserTags, isLoading: userTagsLoading } = useUserTags({
    userId,
    enabled: isAuthorized && Boolean(userId),
  });

  // useLayoutEffect (not useEffect) so form.reset + setIsPageLoading(false)
  // commit before the browser paints. When the dto is already cached at mount
  // (the common profile → edit nav), this skips the one-frame `<PageLoading />`
  // spinner that otherwise paints between the initial render and the effect.
  useLayoutEffect(() => {
    if (!isAuthorized || !userDto || userTagsLoading) return;

    const mentorFlag = Boolean(userDto.is_mentor || isMentorOnboarding);
    const experiences =
      userDto.experiences as unknown as MentorExperiencePayload[];

    const parsedExperiences = parseWorkExperiences(experiences);
    const parsedEducations = parseEducations(experiences);
    const parsedLinks = parseLinks(experiences);

    const subjectsByKindIntent = (kind: string, intent: string): string[] =>
      allUserTags
        .filter((t) => t.kind === kind && t.intent === intent)
        .map((t) => t.subject_group)
        .filter((g): g is string => Boolean(g));

    const whatIOfferFromTags = subjectsByKindIntent('what_i_offer', 'OFFER');
    const whatIOfferValues =
      whatIOfferFromTags.length > 0
        ? whatIOfferFromTags
        : parseWhatIOffer(experiences);

    const skillsFromTags = subjectsByKindIntent('skill', 'WANT');
    const skillsValues =
      skillsFromTags.length > 0
        ? skillsFromTags
        : userDto.skills?.interests?.map((i) => i.subject_group) || [];

    const topicsFromTags = subjectsByKindIntent('topic', 'WANT');
    const topicsValues =
      topicsFromTags.length > 0
        ? topicsFromTags
        : userDto.topics?.interests?.map((i) => i.subject_group) || [];

    const positionsFromTags = subjectsByKindIntent('position', 'WANT');
    const positionsValues =
      positionsFromTags.length > 0
        ? positionsFromTags
        : userDto.interested_positions?.interests?.map(
            (i) => i.subject_group
          ) || [];

    const expertisesFromTags = subjectsByKindIntent('expertise', 'OFFER');
    const expertisesValues =
      expertisesFromTags.length > 0
        ? expertisesFromTags
        : userDto.expertises?.professions?.map((i) => i.subject_group) || [];

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
      expertises: expertisesValues,
      interested_positions: positionsValues,
      skills: skillsValues,
      topics: topicsValues,
    });

    setIsMentor(mentorFlag);
    setIsPageLoading(false);
  }, [
    userDto,
    allUserTags,
    userTagsLoading,
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

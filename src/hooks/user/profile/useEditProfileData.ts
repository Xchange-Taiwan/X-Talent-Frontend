'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { mapVoToFormValues } from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';

interface Options {
  userId: number;
  form: UseFormReturn<ProfileFormValues>;
  isAuthorized: boolean;
  isMentorOnboarding: boolean;
}

export function useEditProfileData({
  userId,
  form,
  isAuthorized,
  isMentorOnboarding,
}: Options) {
  const [isMentor, setIsMentor] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isError, setIsError] = useState(false);

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

    const formValues = mapVoToFormValues(userDto, isMentorOnboarding);
    form.reset(formValues);

    setIsMentor(formValues.is_mentor);
    setIsPageLoading(false);
    setIsError(false);
  }, [userDto, isAuthorized, isMentorOnboarding, form]);

  useEffect(() => {
    if (!error) return;
    // Sanitized to prevent PII / secret leak to Sentry console capture
    console.error('Failed to fetch user data:', error);
    setIsPageLoading(false);
    setIsError(true);
  }, [error]);

  return { isMentor, isPageLoading, isError };
}

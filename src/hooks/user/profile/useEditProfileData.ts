'use client';
import { useEffect } from 'react';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';

interface Options {
  userId: number;
  isAuthorized: boolean;
}

export function useEditProfileData({ userId, isAuthorized }: Options) {
  // Fire the user fetch in parallel with auth resolution.
  const { userDto, error } = useUserProfileDto(userId, 'zh_TW');

  useEffect(() => {
    if (!error) return;
    // Sanitized with String() to prevent raw object/header leaks to Sentry console capturing
    console.error(
      'Failed to fetch user data:',
      typeof error === 'string' ? error : String(error)
    );
  }, [error]);

  const isMentor = userDto ? Boolean(userDto.is_mentor) : false;
  const isError = Boolean(error);
  // Derived page loading state: isPageLoading is false synchronously on the very first render if data is already cached,
  // completely eliminating first-frame loading flashes and layout effects.
  const isPageLoading = !isAuthorized || (!userDto && !error);

  return { userDto, isMentor, isPageLoading, isError };
}

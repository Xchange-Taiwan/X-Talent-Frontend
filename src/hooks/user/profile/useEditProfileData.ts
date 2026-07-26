'use client';
import { useEffect, useState } from 'react';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';

interface Options {
  userId: number;
  isAuthorized: boolean;
}

export function useEditProfileData({ userId, isAuthorized }: Options) {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Fire the user fetch in parallel with auth resolution.
  const { userDto, error } = useUserProfileDto(userId, 'zh_TW');

  useEffect(() => {
    if (!isAuthorized) return;

    if (userDto) {
      setIsPageLoading(false);
      setIsError(false);
    }
  }, [userDto, isAuthorized]);

  useEffect(() => {
    if (!error) return;
    // Sanitized to prevent PII / secret leak to Sentry console capture
    console.error(
      'Failed to fetch user data:',
      typeof error === 'string' ? error : String(error)
    );
    setIsPageLoading(false);
    setIsError(true);
  }, [error]);

  const isMentor = userDto ? Boolean(userDto.is_mentor) : false;

  return { userDto, isMentor, isPageLoading, isError };
}

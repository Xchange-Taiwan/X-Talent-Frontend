'use client';
import { useEffect } from 'react';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';

interface Options {
  userId: number;
}

export function useEditProfileData({ userId }: Options) {
  // Fire the user fetch in parallel with auth resolution.
  const { userDto, error } = useUserProfileDto(userId, 'zh_TW');

  useEffect(() => {
    if (!error) return;

    // Safely serialize and extract error message without exposing full Axios config / PII headers to Sentry
    const errObj = error as unknown;
    console.error(
      'Failed to fetch user data:',
      typeof error === 'string'
        ? error
        : errObj instanceof Error
          ? errObj.message
          : typeof errObj === 'object' && errObj && 'message' in errObj
            ? String((errObj as Record<string, unknown>).message)
            : 'Unknown error'
    );
  }, [error]);

  const isMentor = userDto ? Boolean(userDto.is_mentor) : false;
  const isError = Boolean(error);

  return { userDto, isMentor, isError };
}

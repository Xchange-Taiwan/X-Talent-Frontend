'use client';
import { useEffect } from 'react';

import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { getSafeErrorMessage } from '@/lib/errorUtils';
import { prefetchPresignedUrl } from '@/services/profile/updateAvatar';

interface Options {
  userId: number;
  isAuthorized: boolean;
}

export function useEditProfileData({ userId, isAuthorized }: Options) {
  // Fire the user fetch in parallel with auth resolution.
  const { userDto, error } = useUserProfileDto(userId, 'zh_TW');

  // Warm up the avatar presigned URL once authorized. Saves a serial round
  // trip from the submit waterfall when the user uploads a new avatar.
  useEffect(() => {
    if (!isAuthorized) return;
    const uId = Number(userId);
    if (!Number.isFinite(uId)) return;
    prefetchPresignedUrl(uId);
  }, [isAuthorized, userId]);

  useEffect(() => {
    if (!error) return;
    // Sanitized to prevent PII / secret leak to Sentry console capture
    console.error('Failed to fetch user data:', getSafeErrorMessage(error));
  }, [error]);

  const isMentor = userDto ? Boolean(userDto.is_mentor) : false;
  // Fatal isError is only true if we have an error AND no existing userDto has been resolved.
  // This allows background revalidations (e.g. SWR revalidateOnFocus) to fail silently
  // without triggering a fatal error unmount that would wipe out the user's unsaved form inputs.
  const isError = Boolean(error) && !userDto;

  return { userDto, isMentor, isError };
}

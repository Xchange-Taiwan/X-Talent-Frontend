'use client';

import { useMemo } from 'react';

import type { AvatarMutationSession } from '@/lib/profile/saveProfile';

/**
 * Wraps an `AvatarMutationSession` so `resolve(file)` short-circuits to
 * `undefined` when the user switched to a preset avatar after staging a file,
 * while preserving `markCommitted`, `abort`, and `rollback` delegation.
 */
export function usePresetAwareAvatarSession(
  avatarUpload: AvatarMutationSession,
  presetSelectedRef: { readonly current: boolean }
): AvatarMutationSession {
  return useMemo<AvatarMutationSession>(
    () => ({
      resolve: (file: File | undefined) =>
        presetSelectedRef.current
          ? Promise.resolve(undefined)
          : avatarUpload.resolve(file),
      markCommitted: () => {
        avatarUpload.markCommitted();
      },
      abort: () => {
        avatarUpload.abort?.();
      },
      rollback: () => avatarUpload.rollback?.() ?? Promise.resolve(),
    }),
    [avatarUpload, presetSelectedRef]
  );
}

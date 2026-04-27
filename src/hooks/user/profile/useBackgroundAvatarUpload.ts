'use client';

import { useCallback, useEffect, useRef } from 'react';

import { updateAvatar } from '@/services/profile/updateAvatar';

interface AvatarUploadJob {
  file: File;
  controller: AbortController;
  promise: Promise<string | undefined>;
}

export interface UseBackgroundAvatarUpload {
  kickOff: (file: File) => void;
  consume: (file: File | undefined) => Promise<string | undefined>;
}

/**
 * Starts the S3 avatar upload the moment the user picks/crops a file, so
 * the submit flow can `consume` an already-resolved URL instead of waiting
 * for a fresh round trip. Mirrors the onboarding pattern but triggers from
 * the field's onChange rather than a step transition.
 */
export function useBackgroundAvatarUpload(): UseBackgroundAvatarUpload {
  const jobRef = useRef<AvatarUploadJob | null>(null);

  useEffect(() => {
    return () => {
      jobRef.current?.controller.abort();
      jobRef.current = null;
    };
  }, []);

  const kickOff = useCallback((file: File) => {
    const current = jobRef.current;
    if (current?.file === file) return;

    current?.controller.abort();

    const controller = new AbortController();
    const promise = updateAvatar(file, controller.signal).catch((err) => {
      // Aborts are expected when the user re-crops or unmounts — swallow so
      // they don't surface as upload failures at submit time.
      if (controller.signal.aborted) return undefined;
      throw err;
    });
    jobRef.current = { file, controller, promise };
  }, []);

  const consume = useCallback(
    async (file: File | undefined): Promise<string | undefined> => {
      if (!file) return undefined;
      const current = jobRef.current;
      if (current?.file === file) {
        jobRef.current = null;
        return current.promise;
      }
      // Fallback: kickOff hadn't fired (e.g. file picked outside the wired
      // component) — upload synchronously so the submit still completes.
      return updateAvatar(file);
    },
    []
  );

  return { kickOff, consume };
}

'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';

import { getAvatarSnapshot } from '@/services/profile/getAvatarSnapshot';
import {
  createPresignedUrlCache,
  type PresignedUrlCache,
  updateAvatar,
} from '@/services/profile/updateAvatar';

interface AvatarUploadJob {
  file: File;
  controller: AbortController;
  promise: Promise<string | undefined>;
  // Snapshot of the avatar bytes that were live when the user FIRST started
  // an upload in this session. Preserved across re-uploads (re-crops) so a
  // later rollback restores the state from before the user touched the
  // avatar at all, not from the most recent intermediate file.
  oldBytesPromise: Promise<Blob | null>;
  status: 'uploading' | 'completed' | 'failed';
}

export interface UseBackgroundAvatarUpload {
  kickOff: (file: File, currentAvatarUrl: string | null | undefined) => void;
  consume: (file: File | undefined) => Promise<string | undefined>;
  rollback: () => Promise<void>;
  abort: () => void;
  prefetch: (targetUserId?: number) => void;
}

async function snapshotAvatarBytes(
  url: string | null | undefined
): Promise<Blob | null> {
  if (!url) return null;
  try {
    return await getAvatarSnapshot(url);
  } catch {
    return null;
  }
}

/**
 * Starts the S3 avatar upload the moment the user picks/crops a file, so
 * the submit flow can `consume` an already-resolved URL instead of waiting
 * for a fresh round trip. Mirrors the onboarding pattern but triggers from
 * the field's onChange rather than a step transition.
 *
 * Also exposes `rollback` for the form's discard-changes path: re-uploads
 * the pre-edit avatar bytes so a cancelled session leaves S3 in the state
 * the user had before they picked any file. The S3 key is per-user and
 * stable, so re-uploading the snapshot puts the original image back in the
 * exact same object the new bytes overwrote.
 */
function normalizeNumericUserId(
  value: number | string | null | undefined
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function useBackgroundAvatarUpload(
  explicitUserId?: number | string | null
): UseBackgroundAvatarUpload {
  const jobRef = useRef<AvatarUploadJob | null>(null);
  const presignedCacheRef = useRef<PresignedUrlCache | null>(null);
  if (!presignedCacheRef.current) {
    presignedCacheRef.current = createPresignedUrlCache();
  }

  const { data: sessionData } = useSession();

  const resolvedUserId =
    explicitUserId !== undefined
      ? normalizeNumericUserId(explicitUserId)
      : normalizeNumericUserId(sessionData?.user?.id);

  const userIdRef = useRef<number | undefined>(resolvedUserId);
  useEffect(() => {
    userIdRef.current = resolvedUserId;
    if (resolvedUserId !== undefined) {
      presignedCacheRef.current?.prefetch(resolvedUserId);
    }
  }, [resolvedUserId]);

  const prefetch = useCallback((targetUserId?: number) => {
    const idToWarm = targetUserId ?? userIdRef.current;
    if (idToWarm !== undefined && Number.isFinite(idToWarm) && idToWarm > 0) {
      presignedCacheRef.current?.prefetch(idToWarm);
    }
  }, []);

  const kickOff = useCallback(
    (file: File, currentAvatarUrl: string | null | undefined) => {
      const current = jobRef.current;
      if (current?.file === file) return;

      const oldBytesPromise =
        current?.oldBytesPromise ?? snapshotAvatarBytes(currentAvatarUrl);

      current?.controller.abort();

      const controller = new AbortController();
      const job: AvatarUploadJob = {
        file,
        controller,
        promise: Promise.resolve(undefined),
        oldBytesPromise,
        status: 'uploading',
      };

      job.promise = updateAvatar(
        file,
        userIdRef.current,
        controller.signal
      ).then(
        (url) => {
          job.status = 'completed';
          return url;
        },
        (err) => {
          if (controller.signal.aborted) {
            job.status = 'failed';
            return undefined;
          }
          job.status = 'failed';
          throw err;
        }
      );

      job.promise.catch(() => {});

      jobRef.current = job;
    },
    []
  );

  const abort = useCallback(() => {
    jobRef.current?.controller.abort();
    jobRef.current = null;
  }, []);

  const consume = useCallback(
    async (file: File | undefined): Promise<string | undefined> => {
      if (!file) return undefined;
      const current = jobRef.current;
      if (current?.file === file) {
        jobRef.current = null;
        return current.promise;
      }
      return updateAvatar(file, userIdRef.current);
    },
    []
  );

  const rollback = useCallback(async (): Promise<void> => {
    const job = jobRef.current;
    if (!job) return;
    jobRef.current = null;

    // Wait for the upload to settle so we know the final S3 state. If it's
    // still in flight we can just abort — S3 commits atomically on POST so
    // an aborted upload leaves the original bytes intact.
    if (job.status === 'uploading') {
      job.controller.abort();
      try {
        await job.promise;
      } catch {
        // expected on abort
      }
    }

    if (job.status !== 'completed') {
      // Either aborted before commit or upload failed — S3 still has the
      // pre-edit bytes, no restore needed.
      return;
    }

    // Upload landed in S3. Re-upload the snapshot so the stable per-user
    // key holds the original bytes again. Skipped when there was no prior
    // avatar (first-ever upload); the new file stays in S3, but since the
    // user's profile.avatar wasn't updated we never render the cancelled
    // image anyway.
    const oldBytes = await job.oldBytesPromise;
    if (!oldBytes) return;

    try {
      const restoreFile = new File([oldBytes], 'avatar', {
        type: oldBytes.type || 'image/jpeg',
      });
      await updateAvatar(restoreFile, userIdRef.current);
    } catch (err) {
      // Best-effort: the form is already navigating away on cancel, surfacing
      // a hard error here would be confusing. Log for monitoring instead.
      console.error('avatar rollback failed:', err);
    }
  }, []);

  // Automatically abort in-flight uploads or roll back completed, unconsumed
  // S3 uploads whenever the editor session unmounts (e.g. browser back).
  useEffect(() => {
    return () => {
      void rollback();
    };
  }, [rollback]);

  return { kickOff, consume, rollback, abort, prefetch };
}

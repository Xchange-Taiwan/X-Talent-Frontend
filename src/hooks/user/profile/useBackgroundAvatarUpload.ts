'use client';

import { useCallback, useEffect, useRef } from 'react';

import { updateAvatar } from '@/services/profile/updateAvatar';

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
}

async function snapshotAvatarBytes(
  url: string | null | undefined
): Promise<Blob | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
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
export function useBackgroundAvatarUpload(): UseBackgroundAvatarUpload {
  const jobRef = useRef<AvatarUploadJob | null>(null);

  useEffect(() => {
    return () => {
      jobRef.current?.controller.abort();
      jobRef.current = null;
    };
  }, []);

  const kickOff = useCallback(
    (file: File, currentAvatarUrl: string | null | undefined) => {
      const current = jobRef.current;
      if (current?.file === file) return;

      // Preserve the original snapshot across multiple file picks within the
      // same session. We only fetch on the FIRST kickOff so a rollback restores
      // the truly-pre-edit image, not whichever intermediate crop the user
      // briefly tried.
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

      job.promise = updateAvatar(file, controller.signal).then(
        (url) => {
          job.status = 'completed';
          return url;
        },
        (err) => {
          // Aborts are expected when the user re-crops or unmounts — swallow
          // so they don't surface as upload failures at submit time.
          if (controller.signal.aborted) {
            job.status = 'failed';
            return undefined;
          }
          job.status = 'failed';
          throw err;
        }
      );

      jobRef.current = job;
    },
    []
  );

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
    // key holds the original bytes again.
    const oldBytes = await job.oldBytesPromise;
    if (!oldBytes) {
      // No previous avatar (first upload ever) — nothing to roll back to.
      // The new file stays in S3; without a previous avatar_updated_at on
      // the user's profile the cache buster won't render either way.
      return;
    }

    try {
      const restoreFile = new File([oldBytes], 'avatar', {
        type: oldBytes.type || 'image/jpeg',
      });
      await updateAvatar(restoreFile);
    } catch (err) {
      // Best-effort: the form is already navigating away on cancel, surfacing
      // a hard error here would be confusing. Log for monitoring instead.
      console.error('avatar rollback failed:', err);
    }
  }, []);

  return { kickOff, consume, rollback };
}

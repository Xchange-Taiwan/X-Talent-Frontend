import { upgradeClaritySession } from '@/lib/analytics';
import { apiClient } from '@/lib/apiClient';
import {
  isGooglePrefillAvatarUrl,
  isLocalStaticAvatarUrl,
} from '@/lib/avatar/avatarUrl';
import {
  createPresignedUrlCache,
  type PresignedUrlCache,
  type PresignedUrlData,
  updateAvatar,
} from '@/services/profile/updateAvatar';

type UploadJobStatus = 'uploading' | 'completed' | 'failed' | 'aborted';

interface StagedAvatarJob {
  file: File;
  controller: AbortController;
  promise: Promise<string | undefined>;
  status: UploadJobStatus;
}

export interface AvatarStoragePort {
  userId?: number | (() => number | undefined);
  fetchSnapshot?: (url: string) => Promise<Blob | null>;
  upload?: (
    file: File,
    userId: number | undefined,
    signal?: AbortSignal,
    cache?: PresignedUrlCache
  ) => Promise<string | undefined>;
  fetchPresigned?: (userId: number) => Promise<PresignedUrlData | null>;
  now?: () => number;
  presignedTtlMs?: number;
  onUploadFailed?: (error: unknown) => void;
  onRollbackFailed?: (error: unknown) => void;
}

export interface AvatarUploadSession {
  stage: (file: File, priorAvatarUrl: string | null | undefined) => void;
  resolve: (file: File | undefined) => Promise<string | undefined>;
  markCommitted: () => void;
  rollback: () => Promise<void>;
  abort: () => void;
  prefetch: (targetUserId?: number) => void;
  /**
   * The user switched to a preset (illustration) avatar: cancel any staged
   * upload, restore the pre-edit S3 bytes if they were already overwritten,
   * and short-circuit `resolve()` to `undefined` until the next `stage()`.
   */
  clearStaged: () => Promise<void>;
}

async function capturePriorSnapshot(
  url: string | null | undefined,
  fetchSnapshot: (url: string) => Promise<Blob | null>
): Promise<Blob | null> {
  if (!url || isLocalStaticAvatarUrl(url) || isGooglePrefillAvatarUrl(url)) {
    return null;
  }
  try {
    return await fetchSnapshot(url);
  } catch {
    return null;
  }
}

/**
 * Framework-free two-phase S3 avatar upload state machine.
 *
 * Encapsulates per-session presigned URL caching, abort-on-recrop
 * `AbortController` management, retention of the pre-edit S3 avatar snapshot
 * across multiple re-crops, and two-phase commit/rollback so a completed S3
 * upload can still be restored if the subsequent `PUT /profile` fails.
 */
export function createAvatarUploadSession(
  storagePort: AvatarStoragePort = {}
): AvatarUploadSession {
  const fetchSnapshot =
    storagePort.fetchSnapshot ??
    ((url: string) => apiClient.getExternalBlob(url));
  const uploadFn = storagePort.upload ?? updateAvatar;
  const onUploadFailed =
    storagePort.onUploadFailed ??
    (() => {
      upgradeClaritySession('avatar_upload_failed');
    });
  const onRollbackFailed =
    storagePort.onRollbackFailed ??
    ((err: unknown) => {
      console.error('avatar rollback failed:', err);
    });

  const presignedCache = createPresignedUrlCache({
    fetchPresigned: storagePort.fetchPresigned,
    now: storagePort.now,
    ttlMs: storagePort.presignedTtlMs,
  });

  let activeJob: StagedAvatarJob | null = null;
  let hasCapturedInitialSnapshot = false;
  let oldBytesPromise: Promise<Blob | null> | null = null;
  let hasOverwrittenS3 = false;
  let presetSelected = false;

  function resolveUserId(): number | undefined {
    const raw =
      typeof storagePort.userId === 'function'
        ? storagePort.userId()
        : storagePort.userId;
    return raw !== undefined && Number.isFinite(raw) && raw > 0
      ? raw
      : undefined;
  }

  function prefetch(targetUserId?: number): void {
    const uid = targetUserId ?? resolveUserId();
    if (uid !== undefined && Number.isFinite(uid) && uid > 0) {
      presignedCache.prefetch(uid);
    }
  }

  function stage(file: File, priorAvatarUrl: string | null | undefined): void {
    presetSelected = false;
    if (activeJob?.file === file) return;

    if (!hasCapturedInitialSnapshot) {
      hasCapturedInitialSnapshot = true;
      oldBytesPromise = capturePriorSnapshot(priorAvatarUrl, fetchSnapshot);
    }

    activeJob?.controller.abort();

    const controller = new AbortController();
    const job: StagedAvatarJob = {
      file,
      controller,
      promise: Promise.resolve(undefined),
      status: 'uploading',
    };

    job.promise = uploadFn(
      file,
      resolveUserId(),
      controller.signal,
      presignedCache
    ).then(
      (url) => {
        if (controller.signal.aborted) {
          job.status = 'aborted';
          return undefined;
        }
        if (url !== undefined) {
          hasOverwrittenS3 = true;
        }
        job.status = 'completed';
        return url;
      },
      (err: unknown) => {
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          job.status = 'aborted';
          return undefined;
        }
        job.status = 'failed';
        onUploadFailed(err);
        throw err;
      }
    );

    job.promise.catch(() => {});
    activeJob = job;
  }

  async function resolve(file: File | undefined): Promise<string | undefined> {
    if (!file || presetSelected) return undefined;

    if (activeJob?.file === file && activeJob.status !== 'aborted') {
      const matchedJob = activeJob;
      try {
        return await matchedJob.promise;
      } catch (err) {
        if (activeJob === matchedJob) {
          activeJob = null;
        }
        throw err;
      }
    }

    activeJob?.controller.abort();
    activeJob = null;

    try {
      const url = await uploadFn(
        file,
        resolveUserId(),
        undefined,
        presignedCache
      );
      if (url !== undefined) {
        hasOverwrittenS3 = true;
        activeJob = {
          file,
          controller: new AbortController(),
          promise: Promise.resolve(url),
          status: 'completed',
        };
      }
      return url;
    } catch (err) {
      onUploadFailed(err);
      throw err;
    }
  }

  function markCommitted(): void {
    activeJob?.controller.abort();
    activeJob = null;
    hasCapturedInitialSnapshot = false;
    oldBytesPromise = null;
    hasOverwrittenS3 = false;
  }

  function abort(): void {
    activeJob?.controller.abort();
    activeJob = null;
    if (!hasOverwrittenS3) {
      hasCapturedInitialSnapshot = false;
      oldBytesPromise = null;
    }
  }

  async function rollback(): Promise<void> {
    const job = activeJob;
    const snapshotPromise = oldBytesPromise;
    const priorOverwritten = hasOverwrittenS3;

    activeJob = null;
    hasCapturedInitialSnapshot = false;
    oldBytesPromise = null;
    hasOverwrittenS3 = false;

    if (!job && !priorOverwritten) {
      return;
    }

    if (job?.status === 'uploading') {
      job.controller.abort();
      try {
        await job.promise;
      } catch {
        // expected on abort
      }
    }

    const didOverwriteS3 = priorOverwritten || job?.status === 'completed';
    if (!didOverwriteS3 || !snapshotPromise) {
      return;
    }

    const oldBytes = await snapshotPromise;
    if (!oldBytes) {
      return;
    }

    try {
      const restoreFile = new File([oldBytes], 'avatar', {
        type: oldBytes.type || 'image/jpeg',
      });
      await uploadFn(restoreFile, resolveUserId(), undefined, presignedCache);
    } catch (err) {
      onRollbackFailed(err);
    }
  }

  function clearStaged(): Promise<void> {
    presetSelected = true;
    return rollback();
  }

  return {
    stage,
    resolve,
    markCommitted,
    rollback,
    abort,
    prefetch,
    clearStaged,
  };
}

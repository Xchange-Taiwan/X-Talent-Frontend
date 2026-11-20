import { describe, expect, it, vi } from 'vitest';

import {
  type AvatarStoragePort,
  createAvatarUploadSession,
} from './avatarUploadSession';
import type { PresignedUrlCache } from './updateAvatar';

function makeFile(name = 'avatar.png', content = 'bytes', type = 'image/png') {
  return new File([content], name, { type });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AvatarUploadSession (framework-free 2-phase upload & rollback)', () => {
  it('completes 2-phase happy path: stage -> resolve -> markCommitted clears snapshot so subsequent rollback is a no-op', async () => {
    const fetchSnapshot = vi
      .fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>()
      .mockResolvedValue(new Blob(['original-bytes'], { type: 'image/jpeg' }));
    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockResolvedValue('https://cdn.example.com/u/42/avatar?v=100');

    const session = createAvatarUploadSession({
      userId: 42,
      fetchSnapshot,
      upload,
    });

    const file = makeFile('crop1.png');
    session.stage(file, 'https://cdn.example.com/u/42/avatar?v=1');

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(
      'https://cdn.example.com/u/42/avatar?v=1'
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      file,
      42,
      expect.any(AbortSignal),
      expect.objectContaining({
        prefetch: expect.any(Function),
        consume: expect.any(Function),
      })
    );

    // Phase 1: resolve awaits upload completion without re-uploading
    const resolvedUrl = await session.resolve(file);
    expect(resolvedUrl).toBe('https://cdn.example.com/u/42/avatar?v=100');
    expect(upload).toHaveBeenCalledTimes(1);

    // Re-calling resolve(file) before markCommitted (e.g. retrying PUT /profile) reuses staged result
    await expect(session.resolve(file)).resolves.toBe(
      'https://cdn.example.com/u/42/avatar?v=100'
    );
    expect(upload).toHaveBeenCalledTimes(1);

    // Phase 2: profile PUT succeeded -> markCommitted clears rollback snapshot
    session.markCommitted();

    // Unmount / post-commit rollback must be a complete no-op
    await session.rollback();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('retains prior avatar snapshot after resolve(file) and restores S3 bytes on rollback() when profile PUT fails before markCommitted()', async () => {
    const originalBlob = new Blob(['original-s3-avatar'], {
      type: 'image/webp',
    });
    const fetchSnapshot = vi
      .fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>()
      .mockResolvedValue(originalBlob);
    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockResolvedValueOnce('https://cdn.example.com/u/42/avatar?v=200')
      .mockResolvedValueOnce('https://cdn.example.com/u/42/avatar?v=201');

    const session = createAvatarUploadSession({
      userId: 42,
      fetchSnapshot,
      upload,
    });

    const file = makeFile('new-avatar.png');
    session.stage(file, 'https://cdn.example.com/u/42/avatar?v=1');

    // Step 1 of save pipeline succeeds: resolve(file) returns S3 URL
    const uploadedUrl = await session.resolve(file);
    expect(uploadedUrl).toBe('https://cdn.example.com/u/42/avatar?v=200');
    expect(upload).toHaveBeenCalledTimes(1);

    // Step 2 (PUT /profile) fails externally -> markCommitted() is NOT called.
    // User cancels or unmounts -> rollback() must restore original S3 bytes!
    await session.rollback();

    expect(upload).toHaveBeenCalledTimes(2);
    const [restoredFile, restoredUserId, restoredSignal, restoredCache] =
      upload.mock.calls[1]!;
    expect(restoredFile.name).toBe('avatar');
    expect(restoredFile.type).toBe('image/webp');
    await expect(restoredFile.text()).resolves.toBe('original-s3-avatar');
    expect(restoredUserId).toBe(42);
    expect(restoredSignal).toBeUndefined();
    expect(restoredCache).toBe(upload.mock.calls[0]![3]);

    // Second rollback (e.g. confirmLeave followed by unmount) must be idempotent
    await session.rollback();
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('aborts in-flight upload on recrop and retains the very first snapshot across multiple recrops', async () => {
    const originalBlob = new Blob(['initial-pre-edit-bytes'], {
      type: 'image/png',
    });
    const fetchSnapshot = vi
      .fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>()
      .mockResolvedValue(originalBlob);

    const signals: AbortSignal[] = [];
    const crop3Deferred = createDeferred<string | undefined>();

    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockImplementation((file, _uid, signal) => {
        if (signal) signals.push(signal);
        if (file.name === 'crop3.png') {
          return crop3Deferred.promise;
        }
        if (file.name === 'avatar') {
          return Promise.resolve('https://cdn.example.com/restored');
        }
        return new Promise((_res, rej) => {
          signal?.addEventListener('abort', () => {
            rej(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

    const onUploadFailed = vi.fn();
    const session = createAvatarUploadSession({
      userId: 7,
      fetchSnapshot,
      upload,
      onUploadFailed,
    });

    const crop1 = makeFile('crop1.png', 'bytes-1');
    const crop2 = makeFile('crop2.png', 'bytes-2');
    const crop3 = makeFile('crop3.png', 'bytes-3');

    // First stage captures initial S3 URL
    session.stage(crop1, 'https://cdn.example.com/u/7/initial.png');
    // Duplicate stage with identical File reference is ignored
    session.stage(crop1, 'https://cdn.example.com/u/7/should-ignore.png');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(signals[0]!.aborted).toBe(false);

    // Second recrop aborts crop1 and preserves original snapshot
    session.stage(crop2, 'blob:http://localhost:3000/preview-crop1');
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);

    // Third recrop aborts crop2 and still preserves original snapshot
    session.stage(crop3, 'https://cdn.example.com/u/7/intermediate-crop2.png');
    expect(signals[1]!.aborted).toBe(true);
    expect(signals[2]!.aborted).toBe(false);

    // Snapshot was fetched ONLY once from the initial pre-edit URL
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).toHaveBeenCalledWith(
      'https://cdn.example.com/u/7/initial.png'
    );
    expect(onUploadFailed).not.toHaveBeenCalled();

    // Complete crop3 upload and then roll back -> restores initial-pre-edit-bytes
    crop3Deferred.resolve('https://cdn.example.com/u/7/crop3?v=3');
    await expect(session.resolve(crop3)).resolves.toBe(
      'https://cdn.example.com/u/7/crop3?v=3'
    );

    await session.rollback();
    expect(upload).toHaveBeenCalledTimes(4);
    const restoredFile = upload.mock.calls[3]![0];
    await expect(restoredFile.text()).resolves.toBe('initial-pre-edit-bytes');
  });

  it('restores original S3 snapshot on rollback even if crop 1 completed and crop 2 is still in-flight when cancelled', async () => {
    const fetchSnapshot = vi
      .fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>()
      .mockResolvedValue(new Blob(['pre-crop1-bytes'], { type: 'image/jpeg' }));

    let crop2Signal: AbortSignal | undefined;
    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockImplementation((file, _uid, signal) => {
        if (file.name === 'crop1.png') {
          return Promise.resolve('https://cdn.example.com/u/42/crop1?v=1');
        }
        if (file.name === 'crop2.png') {
          crop2Signal = signal;
          return new Promise((_res, rej) => {
            signal?.addEventListener('abort', () => {
              rej(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        return Promise.resolve('https://cdn.example.com/u/42/restored');
      });

    const session = createAvatarUploadSession({
      userId: 42,
      fetchSnapshot,
      upload,
    });

    const crop1 = makeFile('crop1.png');
    session.stage(crop1, 'https://cdn.example.com/u/42/original.jpg');
    await session.resolve(crop1);

    // User starts crop2 (still uploading), then cancels via rollback()
    const crop2 = makeFile('crop2.png');
    session.stage(crop2, 'https://cdn.example.com/u/42/crop1?v=1');
    expect(crop2Signal?.aborted).toBe(false);

    await session.rollback();

    expect(crop2Signal?.aborted).toBe(true);
    // Because crop1 had already overwritten S3, rollback MUST still restore original.jpg!
    expect(upload).toHaveBeenCalledTimes(3);
    await expect(upload.mock.calls[2]![0].text()).resolves.toBe(
      'pre-crop1-bytes'
    );
  });

  it('skips snapshot fetch for null, local static preset, or Google OAuth prefill URLs and preserves null-snapshot across recrops', async () => {
    const fetchSnapshot =
      vi.fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>();
    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockResolvedValue('https://cdn.example.com/u/42/new?v=1');

    const session = createAvatarUploadSession({
      userId: 42,
      fetchSnapshot,
      upload,
    });

    const crop1 = makeFile('crop1.png');
    session.stage(crop1, '/avatars/default_2.webp');
    await session.resolve(crop1);

    // Recropping when preview shows S3 URL must NOT snapshot crop1's S3 URL
    const crop2 = makeFile('crop2.png');
    session.stage(crop2, 'https://cdn.example.com/u/42/new?v=1');
    await session.resolve(crop2);

    await session.rollback();

    expect(fetchSnapshot).not.toHaveBeenCalled();
    // Only the 2 uploads occurred; no restore upload because initial avatar was a preset
    expect(upload).toHaveBeenCalledTimes(2);

    // Also verify Google OAuth prefill URL skips snapshot after session reset
    const googleCrop = makeFile('google-crop.png');
    session.stage(
      googleCrop,
      'https://lh3.googleusercontent.com/a/ACg8octest=s96-c'
    );
    await session.resolve(googleCrop);
    await session.rollback();
    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it('handles abort(), unstaged resolve() fallback, upload errors with retry recovery, and best-effort rollback errors', async () => {
    const onUploadFailed = vi.fn();
    const onRollbackFailed = vi.fn();

    let abortSignal: AbortSignal | undefined;
    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockImplementationOnce((_file, _uid, signal) => {
        abortSignal = signal;
        return new Promise((_res, rej) => {
          signal?.addEventListener('abort', () => {
            rej(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

    const fetchSnapshot = vi
      .fn<NonNullable<AvatarStoragePort['fetchSnapshot']>>()
      .mockResolvedValue(new Blob(['orig'], { type: 'image/png' }));

    const session = createAvatarUploadSession({
      userId: () => 55,
      fetchSnapshot,
      upload,
      onUploadFailed,
      onRollbackFailed,
    });

    // 1. resolve(undefined) returns undefined immediately
    await expect(session.resolve(undefined)).resolves.toBeUndefined();

    // 2. abort() cancels in-flight upload without triggering onUploadFailed
    const abortedFile = makeFile('abort-me.png');
    session.stage(abortedFile, 'https://cdn.example.com/u/55/orig.png');
    expect(abortSignal?.aborted).toBe(false);
    session.abort();
    expect(abortSignal?.aborted).toBe(true);
    await Promise.resolve();
    expect(onUploadFailed).not.toHaveBeenCalled();

    // 3. Staged upload fails -> surfaces error on resolve(), calls onUploadFailed, and allows clean retry
    const retryFile = makeFile('retry.png');
    upload
      .mockRejectedValueOnce(new Error('Transient S3 503'))
      .mockResolvedValueOnce('https://cdn.example.com/u/55/retry?v=2');

    session.stage(retryFile, 'https://cdn.example.com/u/55/orig.png');
    await expect(session.resolve(retryFile)).rejects.toThrow(
      'Transient S3 503'
    );
    expect(onUploadFailed).toHaveBeenCalledTimes(1);

    // Retrying resolve(retryFile) re-attempts upload and succeeds
    await expect(session.resolve(retryFile)).resolves.toBe(
      'https://cdn.example.com/u/55/retry?v=2'
    );

    // 4. Rollback restore failure is caught and routed to onRollbackFailed without throwing
    upload.mockRejectedValueOnce(new Error('Restore failed'));
    await expect(session.rollback()).resolves.toBeUndefined();
    expect(onRollbackFailed).toHaveBeenCalledTimes(1);

    // 5. Unstaged direct resolve(file) uploads directly via storagePort.upload and caches activeJob='completed' for retry reuse
    const directFile = makeFile('direct.png');
    upload.mockResolvedValueOnce('https://cdn.example.com/u/55/direct?v=3');
    await expect(session.resolve(directFile)).resolves.toBe(
      'https://cdn.example.com/u/55/direct?v=3'
    );
    const callCountAfterDirectResolve = upload.mock.calls.length;
    await expect(session.resolve(directFile)).resolves.toBe(
      'https://cdn.example.com/u/55/direct?v=3'
    );
    expect(upload).toHaveBeenCalledTimes(callCountAfterDirectResolve);
  });

  it('encapsulates per-session presigned URL prefetching and cache consumption', async () => {
    const fetchPresigned = vi.fn().mockResolvedValue({
      url: 'https://s3.example.com/bucket',
      fields: {
        key: 'u/88/avatar',
        AWSAccessKeyId: 'id',
        'x-amz-security-token': 'tok',
        policy: 'pol',
        signature: 'sig',
      },
    });

    const upload = vi
      .fn<NonNullable<AvatarStoragePort['upload']>>()
      .mockImplementation(
        async (
          _file: File,
          userId: number | undefined,
          _signal?: AbortSignal,
          cache?: PresignedUrlCache
        ) => {
          const presigned = await cache?.consume(userId ?? 0);
          return presigned ? `${presigned.url}/${presigned.fields.key}` : '';
        }
      );

    let nowMs = 1_000;
    const session = createAvatarUploadSession({
      userId: 88,
      fetchPresigned,
      upload,
      now: () => nowMs,
      presignedTtlMs: 60_000,
    });

    // Warm presigned cache before user picks a file
    session.prefetch();
    expect(fetchPresigned).toHaveBeenCalledTimes(1);
    expect(fetchPresigned).toHaveBeenCalledWith(88);

    // Stage within TTL consumes the warm cache without a second fetchPresigned call
    nowMs += 5_000;
    const file = makeFile('warm.png');
    session.stage(file, null);
    await expect(session.resolve(file)).resolves.toBe(
      'https://s3.example.com/bucket/u/88/avatar'
    );
    expect(fetchPresigned).toHaveBeenCalledTimes(1);
  });
});

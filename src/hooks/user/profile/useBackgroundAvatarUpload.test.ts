import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateAvatar } from '@/services/profile/updateAvatar';

import { useBackgroundAvatarUpload } from './useBackgroundAvatarUpload';

vi.mock('@/services/profile/updateAvatar', () => ({
  updateAvatar: vi.fn(),
}));

const mockUpdateAvatar = vi.mocked(updateAvatar);

describe('useBackgroundAvatarUpload', () => {
  let mockFetch: typeof global.fetch;

  beforeEach(() => {
    mockFetch = global.fetch;
    global.fetch = vi.fn();
    mockUpdateAvatar.mockReset();
  });

  afterEach(() => {
    global.fetch = mockFetch;
  });

  it('should start S3 upload when kickOff is called with a file', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });
    const mockUrl = 'https://s3.amazonaws.com/bucket/avatar.png?v=123';
    mockUpdateAvatar.mockResolvedValue(mockUrl);

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    expect(mockUpdateAvatar).toHaveBeenCalledWith(
      file,
      expect.any(AbortSignal)
    );
  });

  it('should abort previous upload when a new file is kicked off', async () => {
    const file1 = new File(['avatar-bytes-1'], 'avatar1.png', {
      type: 'image/png',
    });
    const file2 = new File(['avatar-bytes-2'], 'avatar2.png', {
      type: 'image/png',
    });

    const signals: AbortSignal[] = [];
    mockUpdateAvatar.mockImplementation((_file, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file1, 'https://old-avatar.com/old.png');
    });

    expect(signals.length).toBe(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => {
      result.current.kickOff(file2, 'https://old-avatar.com/old.png');
    });

    expect(signals.length).toBe(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('should abort current upload when kickOff is called with undefined', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });

    const signals: AbortSignal[] = [];
    mockUpdateAvatar.mockImplementation((_file, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    expect(signals.length).toBe(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => {
      result.current.kickOff(undefined, 'https://old-avatar.com/old.png');
    });

    expect(signals[0].aborted).toBe(true);
  });

  it('should consume the in-flight upload when consume is called with the matching file', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });
    const mockUrl = 'https://s3.amazonaws.com/bucket/avatar.png?v=123';
    mockUpdateAvatar.mockResolvedValue(mockUrl);

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    let returnedUrl: string | undefined;
    await act(async () => {
      returnedUrl = await result.current.consume(file);
    });

    expect(returnedUrl).toBe(mockUrl);
    expect(mockUpdateAvatar).toHaveBeenCalledTimes(1);
  });

  it('should upload synchronously as fallback if consume is called with a non-matching file', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });
    const mockUrl = 'https://s3.amazonaws.com/bucket/fallback.png?v=456';
    mockUpdateAvatar.mockResolvedValue(mockUrl);

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    let returnedUrl: string | undefined;
    await act(async () => {
      returnedUrl = await result.current.consume(file);
    });

    expect(returnedUrl).toBe(mockUrl);
    expect(mockUpdateAvatar).toHaveBeenCalledWith(file);
  });

  it('should abort active upload on rollback', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });

    const signals: AbortSignal[] = [];
    mockUpdateAvatar.mockImplementation((_file, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    expect(signals[0].aborted).toBe(false);

    // Call rollback in the background and await it
    await act(async () => {
      await result.current.rollback();
    });

    expect(signals[0].aborted).toBe(true);
  });

  it('should restore pre-edit avatar bytes on rollback if upload has completed', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });
    const mockUrl = 'https://s3.amazonaws.com/bucket/avatar.png?v=123';

    // We want the first upload to resolve immediately
    mockUpdateAvatar.mockResolvedValueOnce(mockUrl);

    const mockOldBlob = new Blob(['old-avatar-bytes'], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockOldBlob),
    });
    global.fetch = fetchMock;

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    // Wait a tiny bit for the microtasks to settle and mark status as 'completed'
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.rollback();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://old-avatar.com/old.png',
      expect.any(Object)
    );
    expect(mockUpdateAvatar).toHaveBeenCalledTimes(2);

    const restoredFile = mockUpdateAvatar.mock.calls[1][0];
    expect(restoredFile.name).toBe('avatar');
    expect(restoredFile.type).toBe('image/jpeg');
  });

  it('should abort active upload automatically when hook is unmounted', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });

    const signals: AbortSignal[] = [];
    mockUpdateAvatar.mockImplementation((_file, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { result, unmount } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    expect(signals[0].aborted).toBe(false);

    unmount();

    expect(signals[0].aborted).toBe(true);
  });

  it('should swallow AbortError gracefully when aborted via kickOff(undefined)', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });

    let abortCallback: (() => void) | undefined;
    mockUpdateAvatar.mockImplementation((_file, signal) => {
      return new Promise((resolve, reject) => {
        abortCallback = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', abortCallback);
      });
    });

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    // Abort the job's controller by kicking off with undefined,
    // which triggers the signal's abort event and rejects the promise.
    await act(async () => {
      result.current.kickOff(undefined, 'https://old-avatar.com/old.png');
    });

    // Let the microtasks settle to ensure the internal catch/swallow block executes
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('should bubble up general upload errors on consume', async () => {
    const file = new File(['avatar-bytes'], 'avatar.png', {
      type: 'image/png',
    });
    const mockError = new Error('S3 Network Error');

    let rejectPromise: ((err: Error) => void) | undefined;
    mockUpdateAvatar.mockImplementation(() => {
      return new Promise((_, reject) => {
        rejectPromise = reject;
      });
    });

    const { result } = renderHook(() => useBackgroundAvatarUpload());

    await act(async () => {
      result.current.kickOff(file, 'https://old-avatar.com/old.png');
    });

    // Now call consume (which returns the pending promise), and THEN reject the promise
    const consumePromise = result.current.consume(file);

    await act(async () => {
      rejectPromise?.(mockError);
      await expect(consumePromise).rejects.toThrow('S3 Network Error');
    });
  });
});

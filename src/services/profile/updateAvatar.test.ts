import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
    },
  };
});

import { apiClient, ApiError } from '@/lib/apiClient';

import {
  createPresignedUrlCache,
  type PresignedUrlData,
  type PresignedUrlFields,
  updateAvatar,
} from './updateAvatar';

const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);
const mockFetch = vi.fn();

function makeImageFile(): File {
  return new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
}

/**
 * The presigned-URL success response shape reused by nearly every test
 * below - a factory keeps each test focused on what it's actually
 * asserting instead of restating this boilerplate.
 */
function mockPresignedUrlData(
  key = 'avatar-42.png',
  url = 'https://s3.amazonaws.com/bucket'
): PresignedUrlData {
  return fromPartial<PresignedUrlData>({ url, fields: { key } });
}

describe('updateAvatar service', () => {
  beforeEach(() => {
    mockGetUnwrapped.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('updateAvatar core parameter validation', () => {
    it.each([undefined, 0, NaN])(
      'throws when userId is %s (no auth identity resolved)',
      async (userId) => {
        await expect(updateAvatar(makeImageFile(), userId)).rejects.toThrow(
          '未獲取到有效的身份驗證信息，請重新登入。'
        );
        expect(mockGetUnwrapped).not.toHaveBeenCalled();
      }
    );

    it('throws when the file type does not start with image/', async () => {
      const nonImageFile = new File(['doc-bytes'], 'resume.pdf', {
        type: 'application/pdf',
      });

      await expect(updateAvatar(nonImageFile, 42)).rejects.toThrow(
        '頭像檔案必須是圖片格式 (image/*)。'
      );
      expect(mockGetUnwrapped).not.toHaveBeenCalled();
    });

    it('throws when the file type is empty/undefined', async () => {
      const emptyTypeFile = new File(['bytes'], 'no-ext');
      await expect(updateAvatar(emptyTypeFile, 42)).rejects.toThrow(
        '頭像檔案必須是圖片格式 (image/*)。'
      );
    });
  });

  describe('createPresignedUrlCache caching and invalidation', () => {
    it('does not prefetch if userId is invalid', () => {
      const cache = createPresignedUrlCache();
      cache.prefetch(0);
      cache.prefetch(NaN);
      cache.prefetch(-5);
      expect(mockGetUnwrapped).not.toHaveBeenCalled();
    });

    it('caches presigned url on successful prefetch and consumes it via updateAvatar', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const cache = createPresignedUrlCache();
      cache.prefetch(42);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(1);
      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/storage/presigned-url/42'
      );

      vi.advanceTimersByTime(2 * 60 * 1000);

      const result = await updateAvatar(makeImageFile(), 42, undefined, cache);

      expect(mockGetUnwrapped).toHaveBeenCalledTimes(1);
      expect(result).toBe(
        'https://s3.amazonaws.com/bucket/avatar-42.png?v=1672531320000'
      );
    });

    it('re-fetches if prefetch was for a different user', async () => {
      const mockPresigned42 = mockPresignedUrlData('avatar-42.png');
      const mockPresigned99 = mockPresignedUrlData('avatar-99.png');

      mockGetUnwrapped
        .mockResolvedValueOnce(mockPresigned42)
        .mockResolvedValueOnce(mockPresigned99);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const cache = createPresignedUrlCache();
      cache.prefetch(42);
      expect(mockGetUnwrapped).toHaveBeenCalledWith(
        '/v1/storage/presigned-url/42'
      );

      const result = await updateAvatar(makeImageFile(), 99, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(2);
      expect(mockGetUnwrapped).toHaveBeenLastCalledWith(
        '/v1/storage/presigned-url/99'
      );
      expect(result).toContain('avatar-99.png');
    });

    it('re-fetches if the prefetched cache has expired (> 10 minutes)', async () => {
      const mockPresigned = mockPresignedUrlData();

      mockGetUnwrapped
        .mockResolvedValueOnce(mockPresigned)
        .mockResolvedValueOnce(mockPresigned);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const cache = createPresignedUrlCache();
      cache.prefetch(42);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

      const result = await updateAvatar(makeImageFile(), 42, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(2);
      expect(result).toContain('avatar-42.png');
    });

    it('falls back to fetching again if the cached prefetch promise rejected/failed', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const mockPresigned = mockPresignedUrlData();

      mockGetUnwrapped
        .mockRejectedValueOnce(new ApiError(400, 'Prefetch Network Error'))
        .mockResolvedValueOnce(mockPresigned);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const cache = createPresignedUrlCache();
      cache.prefetch(42);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(1);

      const result = await updateAvatar(makeImageFile(), 42, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(2);
      expect(result).toContain('avatar-42.png');
      consoleErrorSpy.mockRestore();
    });

    it('clears the cache on consumption or explicit clear() so subsequent calls fetch again', async () => {
      const mockPresigned = mockPresignedUrlData();

      mockGetUnwrapped
        .mockResolvedValueOnce(mockPresigned)
        .mockResolvedValueOnce(mockPresigned)
        .mockResolvedValueOnce(mockPresigned)
        .mockResolvedValueOnce(mockPresigned);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const cache = createPresignedUrlCache();
      cache.prefetch(42);

      await updateAvatar(makeImageFile(), 42, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(1);

      await updateAvatar(makeImageFile(), 42, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(2);

      cache.prefetch(42);
      cache.clear();
      await updateAvatar(makeImageFile(), 42, undefined, cache);
      expect(mockGetUnwrapped).toHaveBeenCalledTimes(4);
    });
  });

  describe('updateAvatar error simulations & signal propagation', () => {
    it('simulates presigned URL fetch failure (returns null or throws ApiError)', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetUnwrapped.mockResolvedValueOnce(null);

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );

      mockGetUnwrapped.mockRejectedValueOnce(
        new ApiError(500, 'Presigned endpoint down')
      );
      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );
      consoleErrorSpy.mockRestore();
    });

    it('simulates presigned URL fetch failure (returns incomplete object)', async () => {
      mockGetUnwrapped.mockResolvedValue(
        fromPartial<PresignedUrlData>({
          fields: { key: 'avatar.png' },
        })
      );
      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );

      mockGetUnwrapped.mockResolvedValue(
        fromPartial<PresignedUrlData>({
          url: 'https://bucket.s3.amazonaws.com',
          fields: fromPartial<PresignedUrlFields>({}),
        })
      );
      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );
    });

    it('simulates S3 upload failure with error message from response', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(
        fromPartial<Response>({
          ok: false,
          status: 403,
          text: vi.fn().mockResolvedValue('Access Denied'),
        })
      );

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        'S3 上傳失敗: 403 - Access Denied'
      );
    });

    it('simulates S3 upload failure where response text is unreadable/empty', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(
        fromPartial<Response>({
          ok: false,
          status: 500,
          text: vi.fn().mockRejectedValue(new Error('Cannot read text')),
        })
      );

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        'S3 上傳失敗: 500'
      );
    });

    it('simulates S3 upload failure with a network/fetch error (TypeError)', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '無法連接到伺服器。請檢查您的網絡連接。'
      );
    });

    it('handles unexpected errors (not instance of Error)', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockRejectedValue('Some string exception');

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '未知的錯誤發生'
      );
    });

    it('handles pre-aborted signals', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());

      const controller = new AbortController();
      controller.abort();

      await expect(
        updateAvatar(makeImageFile(), 42, controller.signal)
      ).rejects.toThrow(/Aborted|AbortError/);
    });

    it('handles signals aborted during upload', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());

      const controller = new AbortController();
      mockFetch.mockImplementation((_url, options) => {
        if (options?.signal?.aborted) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      await expect(
        updateAvatar(makeImageFile(), 42, controller.signal)
      ).rejects.toThrow(/Aborted|AbortError/);
    });
  });

  describe('buildS3ObjectUrl formatting', () => {
    it('appends key correctly when bucket URL ends with a slash', async () => {
      mockGetUnwrapped.mockResolvedValue(
        mockPresignedUrlData(
          'avatar-42.png',
          'https://s3.amazonaws.com/bucket/'
        )
      );
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const result = await updateAvatar(makeImageFile(), 42);
      expect(result).toBe(
        'https://s3.amazonaws.com/bucket/avatar-42.png?v=1672531200000'
      );
    });

    it('appends key correctly when bucket URL does not end with a slash', async () => {
      mockGetUnwrapped.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const result = await updateAvatar(makeImageFile(), 42);
      expect(result).toBe(
        'https://s3.amazonaws.com/bucket/avatar-42.png?v=1672531200000'
      );
    });
  });
});

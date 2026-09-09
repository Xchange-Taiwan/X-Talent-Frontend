import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchPresignedUrl,
  PresignedUrlData,
  PresignedUrlFields,
} from '@/services/profile/presignedUrl';

vi.mock('@/services/profile/presignedUrl', () => ({
  fetchPresignedUrl: vi.fn(),
}));

const mockFetchPresignedUrl = vi.mocked(fetchPresignedUrl);
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
  let updateAvatar: typeof import('./updateAvatar').updateAvatar;
  let prefetchPresignedUrl: typeof import('./updateAvatar').prefetchPresignedUrl;

  beforeEach(async () => {
    mockFetchPresignedUrl.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
    // Reset system time to a fixed timestamp to ensure consistency
    vi.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

    // Isolate module state (like presignedCache) for each test
    vi.resetModules();
    const mod = await import('./updateAvatar');
    updateAvatar = mod.updateAvatar;
    prefetchPresignedUrl = mod.prefetchPresignedUrl;
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
        expect(mockFetchPresignedUrl).not.toHaveBeenCalled();
      }
    );

    it('throws when the file type does not start with image/', async () => {
      const nonImageFile = new File(['doc-bytes'], 'resume.pdf', {
        type: 'application/pdf',
      });

      await expect(updateAvatar(nonImageFile, 42)).rejects.toThrow(
        '頭像檔案必須是圖片格式 (image/*)。'
      );
      expect(mockFetchPresignedUrl).not.toHaveBeenCalled();
    });

    it('throws when the file type is empty/undefined', async () => {
      const emptyTypeFile = new File(['bytes'], 'no-ext');
      // Overriding read-only type property isn't standard, so we can mock or construct.
      // File constructor defaults empty type to ""
      await expect(updateAvatar(emptyTypeFile, 42)).rejects.toThrow(
        '頭像檔案必須是圖片格式 (image/*)。'
      );
    });
  });

  describe('prefetchPresignedUrl caching and invalidation', () => {
    it('does not prefetch if userId is invalid', () => {
      prefetchPresignedUrl(0);
      prefetchPresignedUrl(NaN);
      prefetchPresignedUrl(-5);
      expect(mockFetchPresignedUrl).not.toHaveBeenCalled();
    });

    it('caches presigned url on successful prefetch and consumes it', async () => {
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      // Trigger prefetch
      prefetchPresignedUrl(42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(1);

      // Advance time slightly, well within 10 mins TTL
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Call updateAvatar: should consume the cached promise without fetching again
      const result = await updateAvatar(makeImageFile(), 42);

      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(1); // Still 1!
      expect(result).toBe(
        'https://s3.amazonaws.com/bucket/avatar-42.png?v=1672531320000'
      ); // 2 mins after 2023-01-01
    });

    it('re-fetches if prefetch was for a different user', async () => {
      const mockPresigned42 = mockPresignedUrlData('avatar-42.png');
      const mockPresigned99 = mockPresignedUrlData('avatar-99.png');

      mockFetchPresignedUrl
        .mockResolvedValueOnce(mockPresigned42)
        .mockResolvedValueOnce(mockPresigned99);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      prefetchPresignedUrl(42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledWith(42);

      // Consuming for a different user (99) - should bypass cache and fetch directly
      const result = await updateAvatar(makeImageFile(), 99);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(2);
      expect(mockFetchPresignedUrl).toHaveBeenLastCalledWith(99);
      expect(result).toContain('avatar-99.png');
    });

    it('re-fetches if the prefetched cache has expired (> 10 minutes)', async () => {
      const mockPresigned = mockPresignedUrlData();

      mockFetchPresignedUrl
        .mockResolvedValueOnce(mockPresigned) // For prefetch
        .mockResolvedValueOnce(mockPresigned); // For updateAvatar direct call

      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      prefetchPresignedUrl(42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL (10 minutes + 1 second)
      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

      // Consume: should re-fetch because the cache expired
      const result = await updateAvatar(makeImageFile(), 42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(2);
      expect(result).toContain('avatar-42.png');
    });

    it('falls back to fetching again if the cached prefetch promise rejected/failed', async () => {
      const mockPresigned = mockPresignedUrlData();

      mockFetchPresignedUrl
        .mockRejectedValueOnce(new Error('Prefetch Network Error')) // Prefetch fails
        .mockResolvedValueOnce(mockPresigned); // Fallback inside consumePresignedUrl succeeds

      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      prefetchPresignedUrl(42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(1);

      // Consume: since prefetch failed (returning null in catch block), it should fetch again
      const result = await updateAvatar(makeImageFile(), 42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(2);
      expect(result).toContain('avatar-42.png');
    });

    it('clears the cache on consumption so subsequent calls fetch again', async () => {
      const mockPresigned = mockPresignedUrlData();

      mockFetchPresignedUrl
        .mockResolvedValueOnce(mockPresigned)
        .mockResolvedValueOnce(mockPresigned);
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      prefetchPresignedUrl(42);

      // First call consumes and clears cache
      await updateAvatar(makeImageFile(), 42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(1);

      // Second call must fetch again
      await updateAvatar(makeImageFile(), 42);
      expect(mockFetchPresignedUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateAvatar error simulations & signal propagation', () => {
    it('simulates presigned URL fetch failure (returns null)', async () => {
      mockFetchPresignedUrl.mockResolvedValue(null);

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );
    });

    it('simulates presigned URL fetch failure (returns incomplete object)', async () => {
      // Missing url
      mockFetchPresignedUrl.mockResolvedValue(
        fromPartial<PresignedUrlData>({
          fields: { key: 'avatar.png' },
        })
      );
      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '取得 presigned url 失敗或回傳格式不完整'
      );

      // Missing key
      mockFetchPresignedUrl.mockResolvedValue(
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
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
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
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
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
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '無法連接到伺服器。請檢查您的網絡連接。'
      );
    });

    it('handles unexpected errors (not instance of Error)', async () => {
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockRejectedValue('Some string exception');

      await expect(updateAvatar(makeImageFile(), 42)).rejects.toThrow(
        '未知的錯誤發生'
      );
    });

    it('handles pre-aborted signals', async () => {
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());

      const controller = new AbortController();
      controller.abort();

      await expect(
        updateAvatar(makeImageFile(), 42, controller.signal)
      ).rejects.toThrow(/Aborted|AbortError/);
    });

    it('handles signals aborted during upload', async () => {
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());

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
      mockFetchPresignedUrl.mockResolvedValue(
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
      mockFetchPresignedUrl.mockResolvedValue(mockPresignedUrlData());
      mockFetch.mockResolvedValue(fromPartial<Response>({ ok: true }));

      const result = await updateAvatar(makeImageFile(), 42);
      expect(result).toBe(
        'https://s3.amazonaws.com/bucket/avatar-42.png?v=1672531200000'
      );
    });
  });
});

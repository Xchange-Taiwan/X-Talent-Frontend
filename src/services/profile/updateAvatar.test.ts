import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPresignedUrl } from '@/services/profile/presignedUrl';

import { updateAvatar } from './updateAvatar';

vi.mock('@/services/profile/presignedUrl', () => ({
  fetchPresignedUrl: vi.fn(),
}));

const mockFetchPresignedUrl = vi.mocked(fetchPresignedUrl);
const mockFetch = vi.fn();

function makeImageFile(): File {
  return new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
}

describe('updateAvatar', () => {
  beforeEach(() => {
    mockFetchPresignedUrl.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it.each([undefined, 0, NaN])(
    'throws when userId is %s (no auth identity resolved)',
    async (userId) => {
      await expect(updateAvatar(makeImageFile(), userId)).rejects.toThrow(
        '未獲取到有效的身份驗證信息，請重新登入。'
      );
      // Fails fast before ever asking for a presigned URL.
      expect(mockFetchPresignedUrl).not.toHaveBeenCalled();
    }
  );

  it('throws when the file is not an image', async () => {
    const nonImageFile = new File(['doc-bytes'], 'resume.pdf', {
      type: 'application/pdf',
    });

    await expect(updateAvatar(nonImageFile, 42)).rejects.toThrow(
      '頭像檔案必須是圖片格式 (image/*)。'
    );
    expect(mockFetchPresignedUrl).not.toHaveBeenCalled();
  });

  it('uploads to S3 and returns a versioned object URL when given a valid userId', async () => {
    mockFetchPresignedUrl.mockResolvedValue({
      url: 'https://s3.amazonaws.com/bucket',
      fields: {
        key: 'avatar-42.png',
        AWSAccessKeyId: 'abc',
        'x-amz-security-token': 'token',
        policy: 'policy',
        signature: 'sig',
      },
    });
    mockFetch.mockResolvedValue({ ok: true });

    const result = await updateAvatar(makeImageFile(), 42);

    expect(mockFetchPresignedUrl).toHaveBeenCalledWith(42);
    expect(result).toMatch(
      /^https:\/\/s3\.amazonaws\.com\/bucket\/avatar-42\.png\?v=\d+$/
    );
  });
});

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import Page, { generateMetadata, revalidate } from './page';

const { mockNotFound, mockProfileContainer } = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  mockProfileContainer: vi.fn((_props: unknown) => null),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));
vi.mock('./container', () => ({
  default: (props: unknown) => mockProfileContainer(props),
}));
vi.mock('@/components/seo/PersonJsonLd', () => ({
  PersonJsonLd: () => null,
}));
vi.mock('@/services/profile/user.server', () => ({
  fetchUserByIdServer: vi.fn(),
}));
vi.mock('@/services/profile/tagCatalog.server', () => ({
  fetchTagCatalogServer: vi.fn(),
}));
vi.mock('@/lib/profile/tagLabelMap', () => ({
  buildTagLabelMap: vi.fn(() => new Map()),
}));
vi.mock('@/lib/seo/sanitizePublicProfile', () => ({
  sanitizePublicProfile: vi.fn(() => ({ sanitized: true })),
}));
vi.mock('@/lib/seo/buildMentorMetadata', () => ({
  buildMentorMetadata: vi.fn(() => ({ title: 'Mentor Profile' })),
}));

const mockFetchUserByIdServer = vi.mocked(fetchUserByIdServer);
const mockFetchTagCatalogServer = vi.mocked(fetchTagCatalogServer);
const emptyCatalogs = {} as TagCatalogsByBucket;

describe('profile/[pageUserId] generateMetadata', () => {
  beforeEach(() => {
    mockFetchUserByIdServer.mockReset();
    mockFetchTagCatalogServer.mockReset();
  });

  it('returns fallback metadata without fetching when pageUserId is not a valid number', async () => {
    const result = await generateMetadata({
      params: Promise.resolve({ pageUserId: 'not-a-number' }),
    });

    expect(result).toEqual({
      title: 'XChange Talent Pool',
      robots: { index: false, follow: false },
    });
    expect(mockFetchUserByIdServer).not.toHaveBeenCalled();
  });

  it('returns fallback metadata when the profile is not found', async () => {
    mockFetchUserByIdServer.mockResolvedValueOnce(null);
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await generateMetadata({
      params: Promise.resolve({ pageUserId: '123' }),
    });

    expect(result).toEqual({
      title: 'XChange Talent Pool',
      robots: { index: false, follow: false },
    });
  });

  it('awaits the async params and builds metadata when the profile is found', async () => {
    mockFetchUserByIdServer.mockResolvedValueOnce(
      // Only the presence of a truthy DTO matters here; the shape is
      // consumed by the (mocked) sanitizePublicProfile/buildMentorMetadata
      // pipeline, not by generateMetadata itself.
      { user_id: 123 } as never
    );
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await generateMetadata({
      params: Promise.resolve({ pageUserId: '123' }),
    });

    expect(mockFetchUserByIdServer).toHaveBeenCalledWith('123', 'zh_TW');
    expect(result).toEqual({ title: 'Mentor Profile' });
  });

  it('preserves 64-bit user IDs above Number.MAX_SAFE_INTEGER verbatim without float rounding (#953)', async () => {
    mockFetchUserByIdServer.mockResolvedValueOnce(null);
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    await generateMetadata({
      params: Promise.resolve({ pageUserId: '9999999999999999' }),
    });

    expect(mockFetchUserByIdServer).toHaveBeenCalledWith(
      '9999999999999999',
      'zh_TW'
    );

    mockFetchUserByIdServer.mockClear();
    mockFetchUserByIdServer.mockResolvedValueOnce(null);
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    await generateMetadata({
      params: Promise.resolve({ pageUserId: '9007199254740993' }),
    });

    expect(mockFetchUserByIdServer).toHaveBeenCalledWith(
      '9007199254740993',
      'zh_TW'
    );
  });

  it('rejects zero, negative, or non-integer string IDs without fetching (#953)', async () => {
    for (const invalidId of ['0', '-42', '12.34', '123abc', '']) {
      const result = await generateMetadata({
        params: Promise.resolve({ pageUserId: invalidId }),
      });

      expect(result).toEqual({
        title: 'XChange Talent Pool',
        robots: { index: false, follow: false },
      });
    }
    expect(mockFetchUserByIdServer).not.toHaveBeenCalled();
  });

  it('exports a 600-second ISR revalidate interval (#953)', () => {
    expect(revalidate).toBe(600);
  });
});

describe('profile/[pageUserId] Page default export (#953)', () => {
  beforeEach(() => {
    mockFetchUserByIdServer.mockReset();
    mockFetchTagCatalogServer.mockReset();
    mockNotFound.mockClear();
    mockProfileContainer.mockClear();
  });

  it('calls notFound() without fetching when pageUserId is zero, negative, or non-numeric', async () => {
    for (const invalidId of ['0', '-42', 'abc', '0123']) {
      await expect(
        Page({ params: Promise.resolve({ pageUserId: invalidId }) })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    }

    expect(mockNotFound).toHaveBeenCalledTimes(4);
    expect(mockFetchUserByIdServer).not.toHaveBeenCalled();
    expect(mockProfileContainer).not.toHaveBeenCalled();
  });

  it('forwards 64-bit string user IDs above Number.MAX_SAFE_INTEGER intact to fetchUserByIdServer and ProfilePageContainer', async () => {
    for (const snowflakeId of ['9007199254740993', '9999999999999999']) {
      mockFetchUserByIdServer.mockResolvedValueOnce({
        user_id: 123,
      } as never);
      mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

      const element = await Page({
        params: Promise.resolve({ pageUserId: snowflakeId }),
      });
      render(element);

      expect(mockFetchUserByIdServer).toHaveBeenLastCalledWith(
        snowflakeId,
        'zh_TW'
      );
      expect(mockProfileContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageUserId: snowflakeId,
        })
      );
    }
  });
});

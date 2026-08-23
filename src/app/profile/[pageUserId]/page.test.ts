import { describe, expect, it, vi } from 'vitest';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import { generateMetadata } from './page';

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

    expect(mockFetchUserByIdServer).toHaveBeenCalledWith(123, 'zh_TW');
    expect(result).toEqual({ title: 'Mentor Profile' });
  });
});

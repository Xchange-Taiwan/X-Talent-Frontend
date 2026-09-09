import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchUserByIdServer } from '@/services/profile/user.server';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { generateMetadata } from './page';

// Unlike page.test.ts (which mocks sanitizePublicProfile/buildMentorMetadata
// entirely), this file only mocks the network-boundary fetches so at least
// one test exercises the real sanitizePublicProfile -> buildMentorMetadata
// pipeline end-to-end, not a fully-mocked stand-in.
vi.mock('@/services/profile/user.server', () => ({
  fetchUserByIdServer: vi.fn(),
}));
vi.mock('@/services/profile/tagCatalog.server', () => ({
  fetchTagCatalogServer: vi.fn(),
}));

const mockFetchUserByIdServer = vi.mocked(fetchUserByIdServer);
const mockFetchTagCatalogServer = vi.mocked(fetchTagCatalogServer);
const emptyCatalogs = fromPartial<TagCatalogsByBucket>({ industry: [] });

describe('profile/[pageUserId] generateMetadata (real sanitize + build pipeline)', () => {
  it('produces real SEO metadata for a mentor profile, not just the mocked stand-in', async () => {
    mockFetchUserByIdServer.mockResolvedValueOnce(
      fromPartial<MentorProfileVO>({
        user_id: 123,
        name: '張華恩',
        avatar: 'https://example.com/avatar.jpg',
        job_title: '資深前端工程師',
        company: '技術核心科技',
        about: '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。',
        is_mentor: true,
        experiences: [],
      })
    );
    mockFetchTagCatalogServer.mockResolvedValueOnce(emptyCatalogs);

    const result = await generateMetadata({
      params: Promise.resolve({ pageUserId: '123' }),
    });

    expect(result.title).toBe('張華恩 - 導師專業背景');
    expect(result.description).toBe(
      '這是一個完整的導師簡介，提供前端開發技術與職涯諮詢。'
    );
    expect(result.alternates).toEqual({ canonical: '/profile/123' });
    expect(result.openGraph).toMatchObject({
      type: 'profile',
      title: '張華恩',
      url: '/profile/123',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_noStore: vi.fn(),
}));

vi.mock('@/services/search-mentor/mentors.server', () => ({
  fetchMentorsServer: vi.fn(),
}));

vi.mock('@/services/profile/tagCatalog.server', () => ({
  fetchTagCatalogServer: vi.fn(),
}));

vi.mock('./container', () => ({
  default: vi.fn((props: Record<string, unknown>) => props), // Avoid 'any' by using Record<string, unknown>
}));

import { unstable_noStore } from 'next/cache';

import { fetchTagCatalogServer } from '@/services/profile/tagCatalog.server';
import { fetchMentorsServer } from '@/services/search-mentor/mentors.server';
import type { MentorType } from '@/types/mentor';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import MentorPoolWithData from './MentorPoolWithData';

const mockUnstableNoStore = vi.mocked(unstable_noStore);
const mockFetchMentorsServer = vi.mocked(fetchMentorsServer);
const mockFetchTagCatalogServer = vi.mocked(fetchTagCatalogServer);

describe('MentorPoolWithData', () => {
  it('calls fetchMentorsServer and passes correct props on success', async () => {
    const mockMentors = [
      { user_id: 1, updated_at: 123 },
    ] as unknown as MentorType[];
    const mockTagCatalog = {
      industry: [],
      have_skill: [],
      have_topic: [],
    } as unknown as TagCatalogsByBucket;

    mockFetchMentorsServer.mockResolvedValueOnce(mockMentors);
    mockFetchTagCatalogServer.mockResolvedValueOnce(mockTagCatalog);

    const jsx = await MentorPoolWithData();

    // Verify container received the fetched mentors and initialError is false
    expect(jsx.props.initialMentors).toEqual([{ user_id: 1, updated_at: 123 }]);
    expect(jsx.props.initialError).toBe(false);
    expect(mockUnstableNoStore).not.toHaveBeenCalled();
  });

  it('handles fetchMentorsServer rejection, calls unstable_noStore, and passes initialError=true', async () => {
    mockFetchMentorsServer.mockRejectedValueOnce(new Error('Network error'));
    const mockTagCatalog = {
      industry: [],
      have_skill: [],
      have_topic: [],
    } as unknown as TagCatalogsByBucket;
    mockFetchTagCatalogServer.mockResolvedValueOnce(mockTagCatalog);

    const spyConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const jsx = await MentorPoolWithData();

    // Verify unstable_noStore was called to protect Next.js ISR cache
    expect(mockUnstableNoStore).toHaveBeenCalled();
    // Verify container received empty initialMentors and initialError is true
    expect(jsx.props.initialMentors).toEqual([]);
    expect(jsx.props.initialError).toBe(true);

    spyConsoleError.mockRestore();
  });
});

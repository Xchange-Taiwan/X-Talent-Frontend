import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
} from '@/services/profile/tagCatalog';

import useTagCatalog, {
  getTagCatalogCached,
  primeTagCatalogCacheIfEmpty,
} from './useTagCatalog';

vi.mock('@/services/profile/tagCatalog', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/profile/tagCatalog')
  >('@/services/profile/tagCatalog');
  return {
    ...actual,
    fetchTagCatalog: vi.fn(),
  };
});

describe('useTagCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tag catalog and updates state', async () => {
    const mockData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_1', subject: 'Industry 1' }],
    };
    vi.mocked(fetchTagCatalog).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useTagCatalog('en'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.industry).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.industry).toEqual(mockData.industry);
    expect(fetchTagCatalog).toHaveBeenCalledTimes(1);
  });

  it('uses cached data synchronously on subsequent renders', async () => {
    const mockData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_2', subject: 'Industry 2' }],
    };
    vi.mocked(fetchTagCatalog).mockResolvedValueOnce(mockData);

    // First fetch
    await getTagCatalogCached('zh-TW');

    const { result } = renderHook(() => useTagCatalog('zh-TW'));

    // Should load synchronously from cache (isLoading = false initially)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(mockData.industry);
    expect(fetchTagCatalog).toHaveBeenCalledTimes(1);
  });

  it('supports priming the cache', () => {
    const primedData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_3', subject: 'Industry 3' }],
    };

    primeTagCatalogCacheIfEmpty('ja', primedData);

    const { result } = renderHook(() => useTagCatalog('ja'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(primedData.industry);
    expect(fetchTagCatalog).not.toHaveBeenCalled();
  });

  it('respects initialData option for SSR behavior', () => {
    const initialData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_5', subject: 'Industry 5' }],
    };

    const { result } = renderHook(() => useTagCatalog('de', initialData));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(initialData.industry);
    expect(fetchTagCatalog).not.toHaveBeenCalled();
  });

  it('handles fetch failures and allows subsequent retries', async () => {
    vi.mocked(fetchTagCatalog).mockRejectedValueOnce(new Error('Fetch failed'));

    // First call: should fail and surface error
    const { result, unmount } = renderHook(() => useTagCatalog('fr'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load tag catalog');

    // Unmount so we can remount and trigger a fresh fetch
    unmount();

    // Second call: should trigger fetchTagCatalog again because inflight was cleaned up
    const mockData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_4', subject: 'Industry 4' }],
    };
    vi.mocked(fetchTagCatalog).mockResolvedValueOnce(mockData);

    const { result: retryResult } = renderHook(() => useTagCatalog('fr'));

    await waitFor(() => {
      expect(retryResult.current.isLoading).toBe(false);
    });

    expect(retryResult.current.industry).toEqual(mockData.industry);
    expect(fetchTagCatalog).toHaveBeenCalledTimes(2);
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
} from '@/services/profile/tagCatalog';

import useTagCatalog, { tagCatalogReadManager } from './useTagCatalog';

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
    tagCatalogReadManager.clear();
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

    await tagCatalogReadManager.prefetch('zh-TW', (signal) =>
      fetchTagCatalog('zh-TW', signal)
    );

    const { result } = renderHook(() => useTagCatalog('zh-TW'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(mockData.industry);
    expect(fetchTagCatalog).toHaveBeenCalledTimes(1);
  });

  it('supports conditional cache priming via tagCatalogReadManager.prime', () => {
    const primedData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_3', subject: 'Industry 3' }],
    };

    tagCatalogReadManager.prime('ja', primedData, { ifEmpty: true });

    const { result } = renderHook(() => useTagCatalog('ja'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(primedData.industry);
    expect(fetchTagCatalog).not.toHaveBeenCalled();
  });

  it('respects initialData option for SSR hydration and warms the cache post-mount', () => {
    const initialData = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_5', subject: 'Industry 5' }],
    };

    const { result, unmount } = renderHook(() =>
      useTagCatalog('de', initialData)
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.industry).toEqual(initialData.industry);
    expect(fetchTagCatalog).not.toHaveBeenCalled();
    unmount();

    // Subsequent mount without initialData reads the post-mount warmed cache
    const { result: secondMount } = renderHook(() => useTagCatalog('de'));
    expect(secondMount.current.isLoading).toBe(false);
    expect(secondMount.current.industry).toEqual(initialData.industry);
    expect(fetchTagCatalog).not.toHaveBeenCalled();
  });

  it('recovers from an all-empty SSR initialData without poisoning tagCatalogReadManager', async () => {
    const recoveredCatalog = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'IND_6', subject: 'Industry 6' }],
    };
    vi.mocked(fetchTagCatalog).mockResolvedValueOnce(recoveredCatalog);

    const { result, unmount } = renderHook(() =>
      useTagCatalog('es', EMPTY_TAG_CATALOGS)
    );

    // Must NOT poison cache with EMPTY_TAG_CATALOGS on initial mount
    expect(tagCatalogReadManager.get('es')).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchTagCatalog).toHaveBeenCalledTimes(1);
    expect(result.current.industry).toEqual(recoveredCatalog.industry);
    expect(tagCatalogReadManager.get('es')).toEqual(recoveredCatalog);
    unmount();

    // Subsequent mount serves the recovered catalog from cache
    const { result: nextMount } = renderHook(() => useTagCatalog('es'));
    expect(nextMount.current.isLoading).toBe(false);
    expect(nextMount.current.industry).toEqual(recoveredCatalog.industry);
    expect(fetchTagCatalog).toHaveBeenCalledTimes(1);
  });

  it('handles fetch failures and allows subsequent retries', async () => {
    vi.mocked(fetchTagCatalog).mockRejectedValueOnce(new Error('Fetch failed'));

    const { result, unmount } = renderHook(() => useTagCatalog('fr'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load tag catalog');

    unmount();

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

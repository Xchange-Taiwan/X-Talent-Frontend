import { useEffect, useRef } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
} from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export const tagCatalogCache = createKeyedCache<string, TagCatalogsByBucket>();

export const tagCatalogReadManager = new AsyncReadManager<
  string,
  TagCatalogsByBucket
>(tagCatalogCache);

export function getTagCatalogCachedSync(
  language: string
): TagCatalogsByBucket | undefined {
  return tagCatalogReadManager.get(language);
}

/**
 * Seed the in-memory catalog cache from SSR-fetched catalogs so that the
 * first render of useTagCatalog reads localized labels synchronously — avoids
 * a one-frame flash of raw subject_group codes before the client-side fetch
 * resolves. `IfEmpty` preserves any prior client-side prime.
 */
export function primeTagCatalogCacheIfEmpty(
  language: string,
  catalogs: TagCatalogsByBucket
): void {
  if (!language) return;
  tagCatalogCache.prime(language, catalogs, { ifEmpty: true });
}

export async function getTagCatalogCached(
  language: string
): Promise<TagCatalogsByBucket> {
  return tagCatalogCache.fetch(language, () => fetchTagCatalog(language));
}

export interface UseTagCatalogResult extends TagCatalogsByBucket {
  isLoading: boolean;
  error: string | null;
}

export default function useTagCatalog(
  language: string,
  initialData?: TagCatalogsByBucket
): UseTagCatalogResult {
  const initialDataRef = useRef(initialData);
  const initialKeyRef = useRef(language);
  const activeInitialData =
    language === initialKeyRef.current ? initialDataRef.current : undefined;

  useEffect(() => {
    if (activeInitialData !== undefined && language) {
      tagCatalogCache.set(language, activeInitialData);
      initialDataRef.current = undefined;
    }
  }, [language, activeInitialData]);

  const { data, isLoading, error } = useAsyncRead(
    tagCatalogReadManager,
    language || null,
    (signal) => fetchTagCatalog(language, signal),
    {
      initialData: activeInitialData,
    }
  );

  return {
    ...(data ?? EMPTY_TAG_CATALOGS),
    isLoading,
    error: error ? 'Failed to load tag catalog' : null,
  };
}

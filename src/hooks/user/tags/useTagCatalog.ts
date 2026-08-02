import { useEffect, useRef, useState } from 'react';

import { createKeyedCache } from '@/lib/createKeyedCache';
import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
} from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

const tagCatalogCache = createKeyedCache<string, TagCatalogsByBucket>();

export function getTagCatalogCachedSync(
  language: string
): TagCatalogsByBucket | undefined {
  return tagCatalogCache.get(language);
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

  // Lazy-init from initialData, then the sync cache (e.g. seeded by
  // primeTagCatalogCacheIfEmpty during SSR-to-client handoff), and only fall
  // back to EMPTY_TAG_CATALOGS when neither is available. Without this fall-
  // through, callers that don't pass initialData would render raw
  // subject_group codes for one frame before useEffect's fetch resolves.
  const [data, setData] = useState<TagCatalogsByBucket>(
    () => initialData ?? getTagCatalogCachedSync(language) ?? EMPTY_TAG_CATALOGS
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () =>
      initialData === undefined &&
      getTagCatalogCachedSync(language) === undefined
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDataRef.current !== undefined) {
      tagCatalogCache.set(language, initialDataRef.current);
      initialDataRef.current = undefined;
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (!language) {
        setIsLoading(false);
        return;
      }
      // Sync-cache hit: state was already lazy-init'd from cache, so skip
      // the network round trip and stay in non-loading state.
      const cached = getTagCatalogCachedSync(language);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await getTagCatalogCached(language);
        if (cancelled) return;
        setData(result);
      } catch {
        if (cancelled) return;
        setError('Failed to load tag catalog');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return {
    ...data,
    isLoading,
    error,
  };
}

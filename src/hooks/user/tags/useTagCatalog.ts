import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
  type TagCatalogsByBucket,
} from '@/services/profile/tagCatalog';

const tagCatalogDataCache = new Map<string, TagCatalogsByBucket>();
const tagCatalogPromiseCache = new Map<string, Promise<TagCatalogsByBucket>>();

export function getTagCatalogCachedSync(
  language: string
): TagCatalogsByBucket | undefined {
  return tagCatalogDataCache.get(language);
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
  if (tagCatalogDataCache.has(language)) return;
  tagCatalogDataCache.set(language, catalogs);
}

export async function getTagCatalogCached(
  language: string
): Promise<TagCatalogsByBucket> {
  const cached = tagCatalogDataCache.get(language);
  if (cached) return cached;

  const inflight = tagCatalogPromiseCache.get(language);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await fetchTagCatalog(language);
    tagCatalogDataCache.set(language, result);
    tagCatalogPromiseCache.delete(language);
    return result;
  })();

  tagCatalogPromiseCache.set(language, promise);
  return promise;
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
      tagCatalogDataCache.set(language, initialDataRef.current);
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

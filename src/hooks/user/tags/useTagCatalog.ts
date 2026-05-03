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

  const [data, setData] = useState<TagCatalogsByBucket>(
    initialData ?? EMPTY_TAG_CATALOGS
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    initialData === undefined
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

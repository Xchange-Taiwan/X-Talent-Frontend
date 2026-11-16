import { useMemo } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
} from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export const tagCatalogReadManager = new AsyncReadManager<
  string,
  TagCatalogsByBucket
>();

function isEmptyTagCatalog(
  catalog: TagCatalogsByBucket | null | undefined
): boolean {
  if (!catalog) return true;
  return (
    catalog.want_position.length === 0 &&
    catalog.want_skill.length === 0 &&
    catalog.want_topic.length === 0 &&
    catalog.have_skill.length === 0 &&
    catalog.have_topic.length === 0 &&
    catalog.industry.length === 0
  );
}

export function shouldCacheTagCatalog(
  catalog: TagCatalogsByBucket | null | undefined
): boolean {
  return !isEmptyTagCatalog(catalog);
}

export interface UseTagCatalogResult extends TagCatalogsByBucket {
  isLoading: boolean;
  error: string | null;
}

export default function useTagCatalog(
  language: string,
  initialData?: TagCatalogsByBucket
): UseTagCatalogResult {
  // Normalize an all-empty SSR catalog (returned when fetchTagCatalogServer
  // fails on the server) to undefined so useAsyncRead falls back to the
  // client-side fetch instead of caching EMPTY_TAG_CATALOGS.
  const effectiveInitialData = isEmptyTagCatalog(initialData)
    ? undefined
    : initialData;

  const { data, isLoading, error } = useAsyncRead(
    tagCatalogReadManager,
    language || null,
    (signal) => fetchTagCatalog(language, signal),
    {
      initialData: effectiveInitialData,
      shouldCache: shouldCacheTagCatalog,
    }
  );

  const resolvedData = data ?? EMPTY_TAG_CATALOGS;
  const resolvedError = error ? 'Failed to load tag catalog' : null;

  return useMemo(
    () => ({
      ...resolvedData,
      isLoading,
      error: resolvedError,
    }),
    [resolvedData, isLoading, resolvedError]
  );
}

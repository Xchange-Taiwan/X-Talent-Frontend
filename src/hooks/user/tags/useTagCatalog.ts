import { useMemo } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  clearTagCatalogCache,
  EMPTY_TAG_CATALOGS,
  shouldCacheTagCatalog,
  tagCatalogReadModel,
} from '@/lib/profile/tagCatalogReadModel';
import { fetchTagCatalog } from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export { clearTagCatalogCache, shouldCacheTagCatalog, tagCatalogReadModel };

export const tagCatalogReadManager = tagCatalogReadModel;

export interface UseTagCatalogResult extends TagCatalogsByBucket {
  isLoading: boolean;
  error: string | null;
}

export default function useTagCatalog(
  language: string,
  initialData?: TagCatalogsByBucket
): UseTagCatalogResult {
  const key = language.trim() || null;
  const effectiveInitialData = tagCatalogReadModel.resolveInitialData(
    key,
    initialData
  );

  const { data, isLoading, error } = useAsyncRead(
    tagCatalogReadModel,
    key,
    (signal) => fetchTagCatalog(language, signal),
    {
      initialData: effectiveInitialData,
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

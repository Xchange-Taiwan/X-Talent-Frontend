import { apiClient, BASE_URL } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import { EMPTY_TAG_CATALOGS, splitCatalogsByBucket } from './tagCatalog';

const REVALIDATE_SECONDS = 86400;

export async function fetchTagCatalogServer(
  language: string
): Promise<TagCatalogsByBucket> {
  if (!BASE_URL) return EMPTY_TAG_CATALOGS;
  try {
    const data = await apiClient.getUnwrapped<
      components['schemas']['TagCatalogsVO']
    >(`/v1/users/${language}/tags/catalog`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return splitCatalogsByBucket(data);
  } catch (error) {
    console.error('SSR fetchTagCatalog error:', error);
    return EMPTY_TAG_CATALOGS;
  }
}

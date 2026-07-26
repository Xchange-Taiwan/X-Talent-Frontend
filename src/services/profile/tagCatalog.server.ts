import { BASE_URL, fetchServerJson } from '@/lib/apiClient';
import type { components } from '@/types/api';

import {
  EMPTY_TAG_CATALOGS,
  splitCatalogsByBucket,
  type TagCatalogsByBucket,
} from './tagCatalog';

const REVALIDATE_SECONDS = 86400;

export async function fetchTagCatalogServer(
  language: string
): Promise<TagCatalogsByBucket> {
  if (!BASE_URL) return EMPTY_TAG_CATALOGS;
  try {
    const data = await fetchServerJson<components['schemas']['TagCatalogsVO']>(
      `/v1/users/${language}/tags/catalog`,
      { next: { revalidate: REVALIDATE_SECONDS } }
    );
    return splitCatalogsByBucket(data);
  } catch (error) {
    console.error('SSR fetchTagCatalog error:', error);
    return EMPTY_TAG_CATALOGS;
  }
}

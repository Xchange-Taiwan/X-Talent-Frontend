import type { components } from '@/types/api';

import {
  EMPTY_TAG_CATALOGS,
  splitCatalogsByBucket,
  type TagCatalogsByBucket,
} from './tagCatalog';

type ApiResponse = components['schemas']['ApiResponse_TagCatalogsVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const REVALIDATE_SECONDS = 86400;

export async function fetchTagCatalogServer(
  language: string
): Promise<TagCatalogsByBucket> {
  if (!BASE_URL) return EMPTY_TAG_CATALOGS;
  try {
    const res = await fetch(`${BASE_URL}/v1/users/${language}/tags/catalog`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`SSR fetchTagCatalog failed: ${res.status}`);
      return EMPTY_TAG_CATALOGS;
    }
    const result = (await res.json()) as ApiResponse;
    if (result.code !== '0') {
      console.error(`SSR fetchTagCatalog API error: ${result.msg}`);
      return EMPTY_TAG_CATALOGS;
    }
    return splitCatalogsByBucket(result.data);
  } catch (error) {
    console.error('SSR fetchTagCatalog error:', error);
    return EMPTY_TAG_CATALOGS;
  }
}

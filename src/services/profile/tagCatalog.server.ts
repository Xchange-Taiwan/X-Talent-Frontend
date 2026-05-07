import type { components } from '@/types/api';

import {
  EMPTY_TAG_CATALOGS,
  splitCatalogsByBucket,
  type TagCatalogsByBucket,
} from './tagCatalog';

type ApiResponse = components['schemas']['ApiResponse_TagCatalogsVO_'];

// SSR_API_URL is preferred when set, so server-side fetches inside a
// Docker container can reach the BFF via the docker network DNS name
// (e.g. http://bff:8000/api), while the browser bundle still uses
// NEXT_PUBLIC_API_URL (e.g. http://localhost:8006/api).
const BASE_URL =
  process.env.SSR_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export async function fetchTagCatalogServer(
  language: string
): Promise<TagCatalogsByBucket> {
  if (!BASE_URL) return EMPTY_TAG_CATALOGS;
  try {
    const res = await fetch(`${BASE_URL}/v1/users/${language}/tags/catalog`, {
      cache: 'no-store',
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

import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

export type TagCatalogsVO = components['schemas']['TagCatalogsVO'];
export type TagCatalogVO = components['schemas']['TagCatalogVO'];
export type TagCatalogGroupVO = components['schemas']['TagCatalogGroupVO'];
export type TagCatalogLeafVO = components['schemas']['TagCatalogLeafVO'];

type ApiResponse = components['schemas']['ApiResponse_TagCatalogsVO_'];

export type TagBucketKey =
  | 'want_position'
  | 'want_skill'
  | 'want_topic'
  | 'have_skill'
  | 'have_topic';

export const TAG_BUCKET_KEYS: readonly TagBucketKey[] = [
  'want_position',
  'want_skill',
  'want_topic',
  'have_skill',
  'have_topic',
];

export type TagCatalogsByBucket = Record<TagBucketKey, TagCatalogGroupVO[]>;

export const EMPTY_TAG_CATALOGS: TagCatalogsByBucket = {
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
};

// BE returns a flat catalog keyed by `kind` (`skill`/`topic`/`position`) — the
// same skill catalog is reused for both want_skill (mentee picks) and have_skill
// (mentor picks), likewise for topic. Position only applies to want_position.
export function splitCatalogsByBucket(
  catalogs: TagCatalogsVO | null | undefined
): TagCatalogsByBucket {
  if (!catalogs?.catalogs) return { ...EMPTY_TAG_CATALOGS };
  const skillGroups = catalogs.catalogs.skill?.groups ?? [];
  const topicGroups = catalogs.catalogs.topic?.groups ?? [];
  const positionGroups = catalogs.catalogs.position?.groups ?? [];
  return {
    want_position: positionGroups,
    want_skill: skillGroups,
    want_topic: topicGroups,
    have_skill: skillGroups,
    have_topic: topicGroups,
  };
}

export async function fetchTagCatalog(
  language: string
): Promise<TagCatalogsByBucket> {
  try {
    const data = await apiClient.get<ApiResponse>(
      `/v1/users/${language}/tags/catalog`,
      { auth: false }
    );
    if (data.code !== '0') {
      console.error(`API Error: ${data.msg}`);
      return EMPTY_TAG_CATALOGS;
    }
    return splitCatalogsByBucket(data.data);
  } catch (error) {
    console.error('獲取 tag catalog 失敗:', error);
    return EMPTY_TAG_CATALOGS;
  }
}

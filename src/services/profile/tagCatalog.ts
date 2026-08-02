import { apiClient } from '@/lib/apiClient';
import type {
  IndustryOption,
  TagBucketKey,
  TagCatalogsByBucket,
  TagCatalogsVO,
  TagCatalogVO,
} from '@/types/tagCatalog';

export const TAG_BUCKET_KEYS: readonly TagBucketKey[] = [
  'want_position',
  'want_skill',
  'want_topic',
  'have_skill',
  'have_topic',
];

export const EMPTY_TAG_CATALOGS: TagCatalogsByBucket = {
  want_position: [],
  want_skill: [],
  want_topic: [],
  have_skill: [],
  have_topic: [],
  industry: [],
};

// Industry rows have parent_subject_group=NULL in the catalog, so the BFF
// surfaces each industry as a top-level "group" with empty leaves. Project
// each group back into a flat option so consumers can render a single-level
// list.
function extractIndustryOptions(
  catalog: TagCatalogVO | undefined
): IndustryOption[] {
  if (!catalog) return [];
  return (catalog.groups ?? []).map((g) => ({
    subject_group: g.subject_group,
    subject: g.subject,
  }));
}

// BE returns a flat catalog keyed by `kind` (`skill`/`topic`/`position`/
// `industry`). The same skill catalog is reused for both want_skill (mentee
// picks) and have_skill (mentor picks); likewise topic. Position only applies
// to want_position. Industry is flat — see extractIndustryOptions.
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
    industry: extractIndustryOptions(catalogs.catalogs.industry),
  };
}

export async function fetchTagCatalog(
  language: string
): Promise<TagCatalogsByBucket> {
  try {
    const data = await apiClient.getUnwrapped<TagCatalogsVO>(
      `/v1/users/${language}/tags/catalog`,
      { auth: false }
    );
    return splitCatalogsByBucket(data);
  } catch (error) {
    console.error('獲取 tag catalog 失敗:', error);
    return EMPTY_TAG_CATALOGS;
  }
}

// Build a Map<subject_group, subject> from the bucket-shaped catalog so
// callers can resolve raw subject_group codes to localized labels in O(1).
// Includes leaves from all bucket groups plus flat industries.
export function buildTagLabelMap(
  catalogs: TagCatalogsByBucket
): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of TAG_BUCKET_KEYS) {
    for (const group of catalogs[key] ?? []) {
      for (const leaf of group.leaves ?? []) {
        map.set(leaf.subject_group, leaf.subject);
      }
    }
  }
  for (const ind of catalogs.industry) {
    map.set(ind.subject_group, ind.subject);
  }
  return map;
}

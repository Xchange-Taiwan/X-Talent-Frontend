import { TAG_BUCKET_KEYS, type TagCatalogsByBucket } from '@/types/tagCatalog';

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

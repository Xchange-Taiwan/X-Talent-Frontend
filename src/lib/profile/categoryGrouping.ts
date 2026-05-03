import type { Category } from '@/components/ui/category-multi-select';
import type { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

interface SubjectItem {
  subject: string | null;
  subject_group: string;
}

const PLACEHOLDER_BUCKET_LABELS = ['分類 A', '分類 B', '分類 C'] as const;

function bucketIndex(key: string, total: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % total;
}

/**
 * Bucket flat option data into placeholder categories so the two-level UI
 * works while the backend doesn't yet return grouped data. Hash-based bucket
 * keeps each item in a stable section across renders.
 */
export function groupAsPlaceholderCategories(items: SubjectItem[]): Category[] {
  const buckets = PLACEHOLDER_BUCKET_LABELS.map((label, idx) => ({
    key: `placeholder-${idx}`,
    label,
    options: [] as Category['options'],
  }));

  items.forEach((item) => {
    const idx = bucketIndex(item.subject_group, buckets.length);
    buckets[idx].options.push({
      value: item.subject_group,
      label: item.subject ?? '',
    });
  });

  return buckets.filter((b) => b.options.length > 0);
}

/** Flat single category — used for menus that intentionally have no grouping (e.g. industry). */
export function flattenAsSingleCategory(items: SubjectItem[]): Category[] {
  return [
    {
      key: 'all',
      label: '全部',
      options: items.map((i) => ({
        value: i.subject_group,
        label: i.subject ?? '',
      })),
    },
  ];
}

/**
 * Convert tag catalog groups (from /tags/catalog) into the CategoryMultiSelect
 * shape. Each catalog group becomes one expandable section; its leaves become
 * the selectable options. The leaf's `subject_group` is the form value (so it
 * round-trips with the BE PUT body), and its `subject` is the display label.
 */
export function tagGroupsToCategories(groups: TagCatalogGroupVO[]): Category[] {
  return groups.map((group) => ({
    key: group.subject_group,
    label: group.subject,
    options: group.leaves.map((leaf) => ({
      value: leaf.subject_group,
      label: leaf.subject,
    })),
  }));
}

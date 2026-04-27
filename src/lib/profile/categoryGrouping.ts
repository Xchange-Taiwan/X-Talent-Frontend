import type { Category } from '@/components/ui/category-multi-select';

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

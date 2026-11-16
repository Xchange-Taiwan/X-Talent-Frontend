import type { Category } from '@/components/ui/category-multi-select';
import type { TagCatalogGroupVO } from '@/types/tagCatalog';

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
    options: (group.leaves ?? []).map((leaf) => ({
      value: leaf.subject_group,
      label: leaf.subject,
    })),
  }));
}

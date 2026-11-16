import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { TagCatalogGroupVO } from '@/types/tagCatalog';

import { tagGroupsToCategories } from './categoryGrouping';

describe('categoryGrouping utilities', () => {
  describe('tagGroupsToCategories', () => {
    it('maps tag groups to categories correctly', () => {
      const groups = [
        fromPartial<TagCatalogGroupVO>({
          subject_group: 'eng',
          subject: 'Engineering',
          leaves: [
            {
              tag_id: 1,
              subject_group: 'fe',
              subject: 'Frontend',
              language: 'en',
            },
          ],
        }),
      ];

      const result = tagGroupsToCategories(groups);
      expect(result).toEqual([
        {
          key: 'eng',
          label: 'Engineering',
          options: [{ value: 'fe', label: 'Frontend' }],
        },
      ]);
    });

    it('handles missing or undefined leaves gracefully using fallback ?? []', () => {
      const groups = [
        fromPartial<TagCatalogGroupVO>({
          subject_group: 'empty-group',
          subject: 'Empty Group',
          leaves: undefined, // undefined leaves
        }),
      ];

      expect(() => tagGroupsToCategories(groups)).not.toThrow();
      const result = tagGroupsToCategories(groups);
      expect(result).toEqual([
        {
          key: 'empty-group',
          label: 'Empty Group',
          options: [],
        },
      ]);
    });
  });
});

import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { TagCatalogGroupVO } from '@/services/profile/tagCatalog';

import {
  flattenAsSingleCategory,
  groupAsPlaceholderCategories,
  tagGroupsToCategories,
} from './categoryGrouping';

describe('categoryGrouping utilities', () => {
  describe('groupAsPlaceholderCategories', () => {
    it('groups flat options into placeholder categories stably', () => {
      const items = [
        { subject_group: 'item1', subject: 'Item One' },
        { subject_group: 'item2', subject: 'Item Two' },
      ];

      const result = groupAsPlaceholderCategories(items);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((category) => {
        expect(category.key).toContain('placeholder-');
        expect(category.options.length).toBeGreaterThan(0);
      });
    });

    it('returns empty array if items is empty', () => {
      expect(groupAsPlaceholderCategories([])).toEqual([]);
    });
  });

  describe('flattenAsSingleCategory', () => {
    it('creates a single flat category containing all items', () => {
      const items = [
        { subject_group: 'item1', subject: 'Item One' },
        { subject_group: 'item2', subject: null },
      ];

      const result = flattenAsSingleCategory(items);
      expect(result).toEqual([
        {
          key: 'all',
          label: '全部',
          options: [
            { value: 'item1', label: 'Item One' },
            { value: 'item2', label: '' },
          ],
        },
      ]);
    });
  });

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

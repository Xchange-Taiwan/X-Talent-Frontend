import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';

import type { TagCatalogsByBucket, TagCatalogsVO } from './tagCatalog';
import {
  buildTagLabelMap,
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
  splitCatalogsByBucket,
} from './tagCatalog';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    getUnwrapped: vi.fn(),
  },
}));

describe('tagCatalog services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('splitCatalogsByBucket', () => {
    it('returns empty tag catalogs when input is null or undefined', () => {
      expect(splitCatalogsByBucket(null)).toEqual(EMPTY_TAG_CATALOGS);
      expect(splitCatalogsByBucket(undefined)).toEqual(EMPTY_TAG_CATALOGS);
    });

    it('handles partial catalogs with missing groups', () => {
      const catalogsPartial = fromPartial<TagCatalogsVO>({
        catalogs: {
          skill: {
            groups: [
              { subject_group: 'g1', subject: 'Group 1', language: 'zh-TW' },
            ],
          },
          // topic and position are missing
        },
      });

      const result = splitCatalogsByBucket(catalogsPartial);
      expect(result.want_skill).toHaveLength(1);
      expect(result.have_skill).toHaveLength(1);
      expect(result.want_topic).toEqual([]);
      expect(result.want_position).toEqual([]);
    });

    it('extracts industry options correctly', () => {
      const catalogsPartial = fromPartial<TagCatalogsVO>({
        catalogs: {
          industry: {
            groups: [
              {
                subject_group: 'ind1',
                subject: 'Industry 1',
                language: 'zh-TW',
              },
            ],
          },
        },
      });

      const result = splitCatalogsByBucket(catalogsPartial);
      expect(result.industry).toEqual([
        { subject_group: 'ind1', subject: 'Industry 1' },
      ]);
    });
  });

  describe('buildTagLabelMap', () => {
    it('correctly maps leaves and industries', () => {
      const input = fromPartial<TagCatalogsByBucket>({
        want_skill: [
          {
            subject_group: 'g1',
            subject: 'Group 1',
            language: 'zh-TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 's1',
                subject: 'Skill 1',
                language: 'zh-TW',
              },
            ],
          },
        ],
        industry: [{ subject_group: 'ind1', subject: 'Industry 1' }],
      });

      const map = buildTagLabelMap(input);
      expect(map.get('s1')).toBe('Skill 1');
      expect(map.get('ind1')).toBe('Industry 1');
    });

    it('handles missing keys or null values in groups and leaves gracefully', () => {
      const input = fromPartial<TagCatalogsByBucket>({
        want_skill: undefined,
        want_topic: [
          {
            subject_group: 'g2',
            subject: 'Group 2',
            language: 'zh-TW',
            leaves: undefined,
          },
        ],
        industry: [],
      });

      expect(() => buildTagLabelMap(input)).not.toThrow();
      const map = buildTagLabelMap(input);
      expect(map.size).toBe(0);
    });
  });

  describe('fetchTagCatalog', () => {
    it('fetches tag catalogs via apiClient and maps them', async () => {
      const mockResponse = fromPartial<TagCatalogsVO>({
        catalogs: {
          skill: { groups: [] },
        },
      });
      vi.mocked(apiClient.getUnwrapped).mockResolvedValue(mockResponse);

      const result = await fetchTagCatalog('zh-TW');
      expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
        '/v1/users/zh-TW/tags/catalog',
        { auth: false }
      );
      expect(result.want_skill).toEqual([]);
    });

    it('returns EMPTY_TAG_CATALOGS on network/API failure', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
        new Error('Network error')
      );
      const result = await fetchTagCatalog('zh-TW');
      expect(result).toEqual(EMPTY_TAG_CATALOGS);
    });
  });
});

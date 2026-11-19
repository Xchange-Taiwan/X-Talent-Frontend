import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/apiClient';
import { buildTagLabelMap } from '@/lib/profile/tagLabelMap';
import type { TagCatalogsByBucket, TagCatalogsVO } from '@/types/tagCatalog';

import {
  EMPTY_TAG_CATALOGS,
  fetchTagCatalog,
  splitCatalogsByBucket,
} from './tagCatalog';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
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

    it('propagates network/API failures as errors when fallback is unavailable or fails', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Fallback error'));
      await expect(
        fetchTagCatalog('zh-TW', undefined, { allowSameOriginFallback: true })
      ).rejects.toThrow('Network error');
    });

    it('falls back to same-origin /api/tags/[language]/catalog via apiClient.get({ isLocal: true }) when direct BFF fetch fails in browser', async () => {
      vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );
      const populated = fromPartial<TagCatalogsByBucket>({
        ...EMPTY_TAG_CATALOGS,
        want_position: [
          {
            subject_group: 'software_dev',
            subject: '軟體開發',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 7,
                subject_group: 'frontend_engineer',
                subject: '前端工程師',
                language: 'zh_TW',
              },
            ],
          },
        ],
        want_skill: [
          {
            subject_group: 'eng_skill',
            subject: '工程技能',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 8,
                subject_group: 'react',
                subject: 'React',
                language: 'zh_TW',
              },
            ],
          },
        ],
        want_topic: [
          {
            subject_group: 'career_topic',
            subject: '職涯主題',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 9,
                subject_group: 'interview_skills',
                subject: '面試技巧',
                language: 'zh_TW',
              },
            ],
          },
        ],
      });
      vi.mocked(apiClient.get).mockResolvedValueOnce(populated);

      const result = await fetchTagCatalog('zh_TW', undefined, {
        allowSameOriginFallback: true,
      });
      expect(apiClient.get).toHaveBeenCalledWith('/api/tags/zh_TW/catalog', {
        auth: false,
        isLocal: true,
      });
      expect(result.want_position).toHaveLength(1);
    });

    it('rethrows AbortError immediately without invoking same-origin fallback', async () => {
      const controller = new AbortController();
      controller.abort();
      const abortErr = new DOMException('Aborted', 'AbortError');
      vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(abortErr);

      await expect(
        fetchTagCatalog('zh_TW', controller.signal, {
          allowSameOriginFallback: true,
        })
      ).rejects.toBe(abortErr);
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });
});

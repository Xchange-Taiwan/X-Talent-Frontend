import { fromPartial } from '@total-typescript/shoehorn';
import { unstable_cache, unstable_noStore } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { TagCatalogsVO } from '@/types/tagCatalog';

import { EMPTY_TAG_CATALOGS } from './tagCatalog';
import { fetchTagCatalogServer } from './tagCatalog.server';

vi.mock('next/cache', () => ({
  unstable_noStore: vi.fn(),
  unstable_cache: vi.fn(<T extends (...args: never[]) => unknown>(fn: T) => fn),
}));

vi.mock('@/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    BASE_URL: 'https://bff.example.com/dev/api',
    apiClient: {
      getUnwrapped: vi.fn(),
    },
  };
});

const VALID_CATALOG_VO = fromPartial<TagCatalogsVO>({
  catalogs: {
    position: {
      groups: [
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
    },
    skill: {
      groups: [
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
    },
    topic: {
      groups: [
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
    },
    industry: { groups: [] },
  },
});

describe('fetchTagCatalogServer (#1336)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(unstable_cache).mockImplementation(
      <T extends (...args: never[]) => unknown>(fn: T) => fn
    );
  });

  it('retries transient 500 BFF cold-start errors with fresh AbortSignal + cache: no-store per attempt and returns populated want_position', async () => {
    const seenSignals: AbortSignal[] = [];
    vi.mocked(apiClient.getUnwrapped).mockImplementation(
      async (_path, opts) => {
        if (opts?.signal) {
          seenSignals.push(opts.signal);
        }
        expect(opts?.cache).toBe('no-store');
        if (seenSignals.length === 1) {
          throw new ApiError(500, 'Internal server error', '1');
        }
        return VALID_CATALOG_VO;
      }
    );

    const result = await fetchTagCatalogServer('zh_TW', {
      retryDelaysMs: [1, 1],
    });

    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(2);
    expect(seenSignals).toHaveLength(2);
    expect(seenSignals[0]).not.toBe(seenSignals[1]);
    expect(result.want_position).toHaveLength(1);
    expect(result.want_position[0].leaves?.[0]?.subject_group).toBe(
      'frontend_engineer'
    );
    expect(unstable_noStore).not.toHaveBeenCalled();
  });

  it('retries when HTTP 200 returns partial catalog with empty want_position and marks route uncached if still incomplete', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const partialWithoutPosition = fromPartial<TagCatalogsVO>({
      catalogs: {
        position: { groups: [] },
        skill: VALID_CATALOG_VO.catalogs?.skill,
        topic: VALID_CATALOG_VO.catalogs?.topic,
        industry: { groups: [] },
      },
    });
    vi.mocked(apiClient.getUnwrapped).mockResolvedValue(partialWithoutPosition);

    const result = await fetchTagCatalogServer('zh_TW', {
      retryDelaysMs: [1, 1],
    });

    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(3);
    expect(result).toEqual(EMPTY_TAG_CATALOGS);
    expect(unstable_noStore).toHaveBeenCalledTimes(1);
    spyError.mockRestore();
  });

  it('does not retry 4xx client errors and marks route uncached via unstable_noStore', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(400, 'Bad language', '40000')
    );

    const result = await fetchTagCatalogServer('bad_lang', {
      retryDelaysMs: [1, 1],
    });

    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(1);
    expect(result).toEqual(EMPTY_TAG_CATALOGS);
    expect(unstable_noStore).toHaveBeenCalledTimes(1);
    spyError.mockRestore();
  });

  it('calls unstable_noStore after exhausting 5xx retries so empty want_position is never baked into 24h static HTML', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.getUnwrapped).mockRejectedValue(
      new ApiError(500, 'Internal server error', '1')
    );

    const result = await fetchTagCatalogServer('zh_TW', {
      retryDelaysMs: [1, 1],
    });

    expect(apiClient.getUnwrapped).toHaveBeenCalledTimes(3);
    expect(result).toEqual(EMPTY_TAG_CATALOGS);
    expect(unstable_noStore).toHaveBeenCalledTimes(1);
    spyError.mockRestore();
  });
});

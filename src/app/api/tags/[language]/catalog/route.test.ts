import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import * as tagCatalogServerModule from '@/services/profile/tagCatalog.server';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import { GET } from './route';

vi.mock('@/services/profile/tagCatalog.server', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/services/profile/tagCatalog.server')
    >();
  return {
    ...actual,
    fetchTagCatalogServer: vi.fn(),
  };
});

const COMPLETE_CATALOG = fromPartial<TagCatalogsByBucket>({
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

describe('GET /api/tags/[language]/catalog (#1336)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid language segments with 400 to prevent path traversal', async () => {
    const res = await GET(
      new Request('http://localhost/api/tags/..%2Fadmin/catalog'),
      {
        params: Promise.resolve({ language: '../admin' }),
      }
    );

    expect(res.status).toBe(400);
    expect(tagCatalogServerModule.fetchTagCatalogServer).not.toHaveBeenCalled();
  });

  it('returns 200 with TagCatalogsByBucket when all onboarding buckets are populated', async () => {
    vi.mocked(
      tagCatalogServerModule.fetchTagCatalogServer
    ).mockResolvedValueOnce(COMPLETE_CATALOG);

    const res = await GET(
      new Request('http://localhost/api/tags/zh_TW/catalog'),
      {
        params: Promise.resolve({ language: 'zh_TW' }),
      }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as TagCatalogsByBucket;
    expect(body.want_position).toHaveLength(1);
    expect(tagCatalogServerModule.fetchTagCatalogServer).toHaveBeenCalledWith(
      'zh_TW'
    );
  });

  it('returns 502 with no-store when want_position is empty even if other buckets exist', async () => {
    vi.mocked(
      tagCatalogServerModule.fetchTagCatalogServer
    ).mockResolvedValueOnce({
      ...COMPLETE_CATALOG,
      want_position: [],
    });

    const res = await GET(
      new Request('http://localhost/api/tags/zh_TW/catalog'),
      {
        params: Promise.resolve({ language: 'zh_TW' }),
      }
    );

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

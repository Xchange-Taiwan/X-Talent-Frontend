import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import {
  clearTagCatalogCache,
  createTagCatalogReadModel,
  isEmptyTagCatalog,
  shouldCacheTagCatalog,
  tagCatalogReadModel,
} from './tagCatalogReadModel';

const makePopulatedCatalog = (code: string): TagCatalogsByBucket => ({
  ...EMPTY_TAG_CATALOGS,
  industry: [{ subject_group: code, subject: `Label ${code}` }],
});

describe('tagCatalogReadModel', () => {
  beforeEach(() => {
    tagCatalogReadModel.clear();
  });

  it('identifies empty vs populated catalogs accurately across all buckets', () => {
    expect(isEmptyTagCatalog(null)).toBe(true);
    expect(isEmptyTagCatalog(undefined)).toBe(true);
    expect(isEmptyTagCatalog(EMPTY_TAG_CATALOGS)).toBe(true);
    expect(shouldCacheTagCatalog(EMPTY_TAG_CATALOGS)).toBe(false);

    const populated = makePopulatedCatalog('SOFTWARE');
    expect(isEmptyTagCatalog(populated)).toBe(false);
    expect(shouldCacheTagCatalog(populated)).toBe(true);
  });

  it('deduplicates concurrent fetches and treats string language and { language } keys identically', async () => {
    const model = createTagCatalogReadModel();
    const zhCatalog = makePopulatedCatalog('IND_ZH');

    let resolveFetch!: (val: TagCatalogsByBucket) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<TagCatalogsByBucket>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const seenByString: TagCatalogsByBucket[] = [];
    const seenByObj: TagCatalogsByBucket[] = [];

    const unsub1 = model.subscribe('zh_TW', fetcher, (res) => {
      if (res.data) seenByString.push(res.data);
    });
    const unsub2 = model.subscribe({ language: 'zh_TW' }, fetcher, (res) => {
      if (res.data) seenByObj.push(res.data);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(zhCatalog);
    await vi.waitFor(() => {
      expect(seenByString).toEqual([zhCatalog]);
      expect(seenByObj).toEqual([zhCatalog]);
    });

    expect(model.get('zh_TW')).toEqual(zhCatalog);
    expect(model.get({ language: 'zh_TW' })).toEqual(zhCatalog);

    unsub1();
    unsub2();
  });

  it('refuses to cache EMPTY_TAG_CATALOGS across prime, set, prefetch, subscribe, and resolveInitialData', async () => {
    const model = createTagCatalogReadModel();

    expect(
      model.resolveInitialData('zh_TW', EMPTY_TAG_CATALOGS)
    ).toBeUndefined();

    model.prime('zh_TW', EMPTY_TAG_CATALOGS);
    expect(model.get('zh_TW')).toBeUndefined();

    model.set('zh_TW', EMPTY_TAG_CATALOGS);
    expect(model.get('zh_TW')).toBeUndefined();

    await model.prefetch('zh_TW', async () => EMPTY_TAG_CATALOGS);
    expect(model.get('zh_TW')).toBeUndefined();

    const realCatalog = makePopulatedCatalog('DESIGN');
    expect(model.resolveInitialData('zh_TW', realCatalog)).toBe(realCatalog);

    model.prime('zh_TW', realCatalog, { ifEmpty: true });
    expect(model.get('zh_TW')).toEqual(realCatalog);
    expect(model.resolveInitialData('zh_TW', realCatalog)).toBeUndefined();
  });

  it('supports per-locale invalidation, full clear, and isolated read model instances', () => {
    const isolated = createTagCatalogReadModel();
    const zh = makePopulatedCatalog('ZH');
    const en = makePopulatedCatalog('EN');

    tagCatalogReadModel.prime('zh_TW', zh);
    tagCatalogReadModel.prime('en_US', en);
    isolated.prime('zh_TW', makePopulatedCatalog('ISOLATED'));

    clearTagCatalogCache('zh_TW');
    expect(tagCatalogReadModel.get('zh_TW')).toBeUndefined();
    expect(tagCatalogReadModel.get('en_US')).toEqual(en);
    expect(isolated.get('zh_TW')?.industry[0]?.subject_group).toBe('ISOLATED');

    clearTagCatalogCache();
    expect(tagCatalogReadModel.get('en_US')).toBeUndefined();
  });
});

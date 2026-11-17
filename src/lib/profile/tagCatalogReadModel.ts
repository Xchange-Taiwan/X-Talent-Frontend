import {
  type AsyncCacheSnapshot,
  type AsyncPrimeOptions,
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export { EMPTY_TAG_CATALOGS };

export type TagCatalogReadKey = string | { readonly language: string };

export type TagCatalogFetcher = (
  signal: AbortSignal,
  context?: { force?: boolean }
) => Promise<TagCatalogsByBucket>;

export interface CreateTagCatalogReadModelOptions {
  ttlMs?: number;
}

export interface TagCatalogReadModel extends AsyncReadSource<
  TagCatalogReadKey,
  TagCatalogsByBucket
> {
  get(key: TagCatalogReadKey): TagCatalogsByBucket | undefined;
  peek(key: TagCatalogReadKey): TagCatalogsByBucket | undefined;
  getSnapshot(
    key: TagCatalogReadKey
  ): AsyncCacheSnapshot<TagCatalogsByBucket> | undefined;
  set(key: TagCatalogReadKey, value: TagCatalogsByBucket, ttlMs?: number): void;
  prime(
    key: TagCatalogReadKey,
    value: TagCatalogsByBucket,
    options?: AsyncPrimeOptions
  ): void;
  subscribe(
    key: TagCatalogReadKey,
    fetcher: TagCatalogFetcher,
    onUpdate: (result: AsyncReadResult<TagCatalogsByBucket>) => void,
    options?: AsyncReadOptions<TagCatalogsByBucket>
  ): () => void;
  prefetch(
    key: TagCatalogReadKey,
    fetcher: TagCatalogFetcher,
    options?: Omit<
      AsyncReadOptions<TagCatalogsByBucket>,
      'force' | 'initialData'
    >
  ): Promise<AsyncReadResult<TagCatalogsByBucket> | null>;
  refresh(
    key: TagCatalogReadKey,
    fetcher: TagCatalogFetcher,
    options?: Omit<
      AsyncReadOptions<TagCatalogsByBucket>,
      'force' | 'initialData'
    >
  ): Promise<AsyncReadResult<TagCatalogsByBucket> | null>;
  invalidate(key: TagCatalogReadKey): void;
  clear(): void;
  resolveInitialData(
    key: TagCatalogReadKey | null | undefined,
    initialData?: TagCatalogsByBucket
  ): TagCatalogsByBucket | undefined;
}

export function isEmptyTagCatalog(
  catalog: TagCatalogsByBucket | null | undefined
): boolean {
  if (!catalog) return true;
  return (
    catalog.want_position.length === 0 &&
    catalog.want_skill.length === 0 &&
    catalog.want_topic.length === 0 &&
    catalog.have_skill.length === 0 &&
    catalog.have_topic.length === 0 &&
    catalog.industry.length === 0
  );
}

export function shouldCacheTagCatalog(
  catalog: TagCatalogsByBucket | null | undefined
): boolean {
  return !isEmptyTagCatalog(catalog);
}

export function toTagCatalogCacheKey(
  key: TagCatalogReadKey | null | undefined
): string | null {
  if (!key) return null;
  const raw = typeof key === 'string' ? key : key.language;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createTagCatalogReadModel(
  options?: CreateTagCatalogReadModelOptions
): TagCatalogReadModel {
  const manager = new AsyncReadManager<string, TagCatalogsByBucket>({
    ttlMs: options?.ttlMs,
  });

  const resolveInitialData = (
    key: TagCatalogReadKey | null | undefined,
    initialData?: TagCatalogsByBucket
  ): TagCatalogsByBucket | undefined => {
    if (isEmptyTagCatalog(initialData)) {
      return undefined;
    }
    const cacheKey = toTagCatalogCacheKey(key);
    if (!cacheKey) {
      return initialData;
    }
    return manager.getSnapshot(cacheKey) !== undefined
      ? undefined
      : initialData;
  };

  return {
    get(key) {
      const cacheKey = toTagCatalogCacheKey(key);
      return cacheKey ? manager.get(cacheKey) : undefined;
    },

    peek(key) {
      const cacheKey = toTagCatalogCacheKey(key);
      return cacheKey ? manager.peek(cacheKey) : undefined;
    },

    getSnapshot(key) {
      const cacheKey = toTagCatalogCacheKey(key);
      return cacheKey ? manager.getSnapshot(cacheKey) : undefined;
    },

    set(key, value, ttlMs) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (!cacheKey || !shouldCacheTagCatalog(value)) {
        return;
      }
      manager.set(cacheKey, value, ttlMs);
    },

    prime(key, value, primeOptions) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (!cacheKey || !shouldCacheTagCatalog(value)) {
        return;
      }
      manager.prime(cacheKey, value, primeOptions);
    },

    subscribe(key, fetcher, onUpdate, readOptions) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (!cacheKey) {
        return () => {};
      }
      const normalizedOptions: AsyncReadOptions<TagCatalogsByBucket> = {
        ...readOptions,
        initialData: resolveInitialData(key, readOptions?.initialData),
        shouldCache: (value) =>
          shouldCacheTagCatalog(value) &&
          (!readOptions?.shouldCache || readOptions.shouldCache(value)),
      };
      return manager.subscribe(cacheKey, fetcher, onUpdate, normalizedOptions);
    },

    prefetch(key, fetcher, prefetchOptions) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (!cacheKey) {
        return Promise.resolve(null);
      }
      return manager.prefetch(cacheKey, fetcher, {
        ...prefetchOptions,
        shouldCache: (value) =>
          shouldCacheTagCatalog(value) &&
          (!prefetchOptions?.shouldCache || prefetchOptions.shouldCache(value)),
      });
    },

    refresh(key, fetcher, refreshOptions) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (!cacheKey) {
        return Promise.resolve(null);
      }
      return manager.refresh(cacheKey, fetcher, {
        ...refreshOptions,
        shouldCache: (value) =>
          shouldCacheTagCatalog(value) &&
          (!refreshOptions?.shouldCache || refreshOptions.shouldCache(value)),
      });
    },

    invalidate(key) {
      const cacheKey = toTagCatalogCacheKey(key);
      if (cacheKey) {
        manager.invalidate(cacheKey);
      }
    },

    clear() {
      manager.clear();
    },

    resolveInitialData,
  };
}

export const tagCatalogReadModel: TagCatalogReadModel =
  createTagCatalogReadModel();

export function clearTagCatalogCache(language?: TagCatalogReadKey): void {
  if (language !== undefined) {
    tagCatalogReadModel.invalidate(language);
  } else {
    tagCatalogReadModel.clear();
  }
}

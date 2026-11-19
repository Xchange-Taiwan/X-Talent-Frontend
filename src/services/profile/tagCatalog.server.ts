import { unstable_cache, unstable_noStore } from 'next/cache';

import { apiClient, ApiError, BASE_URL } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import {
  EMPTY_TAG_CATALOGS,
  isOnboardingCatalogComplete,
  splitCatalogsByBucket,
} from './tagCatalog';

export { isOnboardingCatalogComplete };

const REVALIDATE_SECONDS = 86400;
const DEFAULT_RETRY_DELAYS_MS = [300, 800] as const;

export interface FetchTagCatalogServerOptions {
  retryDelaysMs?: readonly number[];
}

function isNonRetryableClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

function isMissingIncrementalCacheError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes('incrementalCache missing')
  );
}

function safeMarkUncached(): void {
  try {
    unstable_noStore();
  } catch {
    // Ignore outside Next.js request/static-generation async context.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCatalogUncachedWithRetry(
  language: string,
  options?: FetchTagCatalogServerOptions
): Promise<TagCatalogsByBucket> {
  const retryDelays = options?.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxAttempts = retryDelays.length + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      const delayMs = retryDelays[attempt - 1] ?? 0;
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    // Pass a fresh AbortSignal + cache: 'no-store' per attempt so Next.js 16
    // RSC dedupeFetch never short-circuits retries with a memoized 500 clone
    // and raw unvalidated HTTP 200 envelopes never enter incrementalCache.
    const attemptController = new AbortController();
    try {
      const data = await apiClient.getUnwrapped<
        components['schemas']['TagCatalogsVO']
      >(`/v1/users/${language}/tags/catalog`, {
        auth: false,
        cache: 'no-store',
        signal: attemptController.signal,
      });
      const mapped = splitCatalogsByBucket(data);
      if (isOnboardingCatalogComplete(mapped)) {
        return mapped;
      }
      lastError = new Error(
        `Incomplete tag catalog returned for ${language} (want_position=${mapped.want_position.length})`
      );
    } catch (error) {
      lastError = error;
      if (isNonRetryableClientError(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch tag catalog for ${language}`);
}

const getCachedTagCatalogByLanguage = unstable_cache(
  async (language: string): Promise<TagCatalogsByBucket> =>
    fetchCatalogUncachedWithRetry(language),
  ['tag-catalog-by-language-v1'],
  { revalidate: REVALIDATE_SECONDS }
);

export async function fetchTagCatalogServer(
  language: string,
  options?: FetchTagCatalogServerOptions
): Promise<TagCatalogsByBucket> {
  if (!BASE_URL) {
    safeMarkUncached();
    return EMPTY_TAG_CATALOGS;
  }

  try {
    if (options?.retryDelaysMs !== undefined) {
      const cachedCustom = unstable_cache(
        async (lang: string): Promise<TagCatalogsByBucket> =>
          fetchCatalogUncachedWithRetry(lang, options),
        ['tag-catalog-by-language-v1'],
        { revalidate: REVALIDATE_SECONDS }
      );
      return await cachedCustom(language);
    }
    return await getCachedTagCatalogByLanguage(language);
  } catch (error) {
    if (isMissingIncrementalCacheError(error)) {
      try {
        return await fetchCatalogUncachedWithRetry(language, options);
      } catch (fallbackError) {
        console.error('SSR fetchTagCatalog error:', fallbackError);
        safeMarkUncached();
        return EMPTY_TAG_CATALOGS;
      }
    }
    console.error('SSR fetchTagCatalog error:', error);
    safeMarkUncached();
    return EMPTY_TAG_CATALOGS;
  }
}

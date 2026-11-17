import {
  AsyncReadManager,
  type AsyncReadOptions,
  type AsyncReadResult,
  type AsyncReadSource,
} from '@/lib/asyncReadManager';
import { fetchMentorFeedback } from '@/services/profile/feedback';
import {
  DEFAULT_FEEDBACK_PAGE_SIZE,
  type FetchMentorFeedbackParams,
  type MentorFeedbackItem,
  type MentorFeedbackPage,
} from '@/types/feedback';

import { sortFeedbackItems } from './sortFeedbackItems';

export { sortFeedbackItems };

export const MENTOR_FEEDBACK_CACHE_TTL_MS = 60_000;

const EMPTY_FEEDBACK_ITEMS: MentorFeedbackItem[] = [];

export interface MentorFeedbackReadKey {
  mentorId: number;
  page?: number;
  pageSize?: number;
}

export interface NormalizedMentorFeedbackKey {
  mentorId: number;
  page: number;
  pageSize: number;
}

export type MentorFeedbackPageFetcher = (
  signal: AbortSignal,
  context?: { force?: boolean }
) => Promise<MentorFeedbackPage>;

export type MentorFeedbackPageLoader = (
  params: FetchMentorFeedbackParams
) => Promise<MentorFeedbackPage>;

export interface MentorFeedbackSummary {
  totalRatingCount: number;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  isFallbackEmpty: boolean;
}

export interface MentorFeedbackResolvedView {
  items: MentorFeedbackItem[];
  totalRatingCount: number | null;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  page: number;
  pageSize: number;
  hasLoaded: boolean;
  isFallbackEmpty: boolean;
}

export interface MentorFeedbackReadModelOptions {
  loadPage?: MentorFeedbackPageLoader;
  ttlMs?: number;
}

interface MentorFeedbackMentorSnapshot {
  summary: MentorFeedbackSummary;
  items: MentorFeedbackItem[];
}

export interface MentorFeedbackReadModel extends AsyncReadSource<
  MentorFeedbackReadKey,
  MentorFeedbackPage
> {
  peek(key: MentorFeedbackReadKey): MentorFeedbackPage | undefined;
  resolveView(
    key: MentorFeedbackReadKey,
    state?: {
      data?: MentorFeedbackPage | null;
      isLoading?: boolean;
    }
  ): MentorFeedbackResolvedView;
  /**
   * Invalidates cached mentor feedback pages.
   * - When `mentorId` is a positive finite number, refreshes actively
   *   subscribed page slices for that mentor in place via `loadPage` and drops
   *   unsubscribed cached slices (while cancelling any unsubscribed in-flight
   *   requests), leaving all other mentors untouched.
   * - When `mentorId` is `undefined`, applies the same invalidation/refresh
   *   across every mentor currently tracked in the read model.
   */
  invalidateMentor(mentorId?: number): void;
  clear(): void;
}

export function normalizeMentorFeedbackKey(
  key: MentorFeedbackReadKey
): NormalizedMentorFeedbackKey {
  const safeMentorId =
    typeof key.mentorId === 'number' && Number.isFinite(key.mentorId)
      ? Math.max(0, Math.floor(key.mentorId))
      : 0;
  const safePage =
    typeof key.page === 'number' && Number.isFinite(key.page)
      ? Math.max(1, Math.floor(key.page))
      : 1;
  const safePageSize =
    typeof key.pageSize === 'number' && Number.isFinite(key.pageSize)
      ? Math.max(1, Math.floor(key.pageSize))
      : DEFAULT_FEEDBACK_PAGE_SIZE;

  return {
    mentorId: safeMentorId,
    page: safePage,
    pageSize: safePageSize,
  };
}

export function toMentorFeedbackCacheKey(key: MentorFeedbackReadKey): string {
  const normalized = normalizeMentorFeedbackKey(key);
  return `${normalized.mentorId}:${normalized.page}:${normalized.pageSize}`;
}

export function createMentorFeedbackReadModel({
  loadPage = (params) => fetchMentorFeedback(params),
  ttlMs = MENTOR_FEEDBACK_CACHE_TTL_MS,
}: MentorFeedbackReadModelOptions = {}): MentorFeedbackReadModel {
  const manager = new AsyncReadManager<string, MentorFeedbackPage>({
    ttlMs,
  });

  const knownKeys = new Map<string, NormalizedMentorFeedbackKey>();
  const mentorState = new Map<number, MentorFeedbackMentorSnapshot>();

  const trackNormalizedKey = (
    normalized: NormalizedMentorFeedbackKey
  ): string => {
    const cacheKey = `${normalized.mentorId}:${normalized.page}:${normalized.pageSize}`;
    knownKeys.set(cacheKey, normalized);
    return cacheKey;
  };

  const recordMentorPage = (
    mentorId: number,
    pageData: MentorFeedbackPage
  ): void => {
    if (mentorId <= 0) {
      return;
    }
    mentorState.set(mentorId, {
      summary: {
        totalRatingCount: pageData.totalRatingCount,
        ratingAverage: pageData.ratingAverage,
        completedMeetingCount: pageData.completedMeetingCount,
        isFallbackEmpty: Boolean(pageData.isFallbackEmpty),
      },
      items: pageData.items,
    });
  };

  const invalidateOrRefreshSlice = (
    cacheKey: string,
    parsed: NormalizedMentorFeedbackKey
  ): boolean => {
    if (manager.getListenerCount(cacheKey) > 0) {
      void manager.refresh(cacheKey, async (signal) => {
        const freshPage = await loadPage({
          mentorId: parsed.mentorId,
          page: parsed.page,
          pageSize: parsed.pageSize,
          signal,
        });
        if (!signal.aborted) {
          recordMentorPage(parsed.mentorId, freshPage);
        }
        return freshPage;
      });
      return true;
    }

    manager.invalidate(cacheKey);
    knownKeys.delete(cacheKey);
    return false;
  };

  return {
    get(key) {
      return manager.get(toMentorFeedbackCacheKey(key));
    },

    peek(key) {
      return manager.peek(toMentorFeedbackCacheKey(key));
    },

    set(key, value, customTtlMs) {
      const normalized = normalizeMentorFeedbackKey(key);
      const cacheKey = trackNormalizedKey(normalized);
      recordMentorPage(normalized.mentorId, value);
      manager.set(cacheKey, value, customTtlMs);
    },

    resolveView(key, state) {
      const normalized = normalizeMentorFeedbackKey(key);
      const cacheKey = `${normalized.mentorId}:${normalized.page}:${normalized.pageSize}`;
      const activeData =
        state !== undefined
          ? (state.data ?? null)
          : (manager.peek(cacheKey) ?? null);
      const isLoading = Boolean(state?.isLoading);

      if (activeData !== null) {
        return {
          items: activeData.items,
          totalRatingCount: activeData.totalRatingCount,
          ratingAverage: activeData.ratingAverage,
          completedMeetingCount: activeData.completedMeetingCount,
          page: activeData.page,
          pageSize: activeData.pageSize,
          hasLoaded: true,
          isFallbackEmpty: Boolean(activeData.isFallbackEmpty),
        };
      }

      const prev =
        normalized.mentorId > 0
          ? mentorState.get(normalized.mentorId)
          : undefined;

      return {
        items: isLoading && prev ? prev.items : EMPTY_FEEDBACK_ITEMS,
        totalRatingCount: prev ? prev.summary.totalRatingCount : null,
        ratingAverage: prev ? prev.summary.ratingAverage : null,
        completedMeetingCount: prev ? prev.summary.completedMeetingCount : null,
        page: normalized.page,
        pageSize: normalized.pageSize,
        hasLoaded: prev !== undefined,
        isFallbackEmpty: Boolean(prev?.summary.isFallbackEmpty),
      };
    },

    subscribe(
      key: MentorFeedbackReadKey,
      fetcher: MentorFeedbackPageFetcher,
      onUpdate: (result: AsyncReadResult<MentorFeedbackPage>) => void,
      readOptions?: AsyncReadOptions<MentorFeedbackPage>
    ) {
      const normalized = normalizeMentorFeedbackKey(key);
      const cacheKey = trackNormalizedKey(normalized);

      if (
        readOptions?.initialData !== undefined &&
        !mentorState.has(normalized.mentorId)
      ) {
        recordMentorPage(normalized.mentorId, readOptions.initialData);
      }

      const trackedFetcher: MentorFeedbackPageFetcher = async (
        signal,
        context
      ) => {
        const pageData = await fetcher(signal, context);
        if (!signal.aborted) {
          recordMentorPage(normalized.mentorId, pageData);
        }
        return pageData;
      };

      const unsubscribe = manager.subscribe(
        cacheKey,
        trackedFetcher,
        (result) => {
          if (result.data !== null) {
            recordMentorPage(normalized.mentorId, result.data);
            onUpdate(result);
            return;
          }

          if (result.isLoading && result.error === null) {
            const prev =
              normalized.mentorId > 0
                ? mentorState.get(normalized.mentorId)
                : undefined;
            if (prev !== undefined) {
              onUpdate({
                data: {
                  items: prev.items,
                  totalRatingCount: prev.summary.totalRatingCount,
                  page: normalized.page,
                  pageSize: normalized.pageSize,
                  ratingAverage: prev.summary.ratingAverage,
                  completedMeetingCount: prev.summary.completedMeetingCount,
                  ...(prev.summary.isFallbackEmpty
                    ? { isFallbackEmpty: true }
                    : {}),
                },
                isLoading: true,
                error: null,
              });
              return;
            }
          }

          onUpdate(result);
        },
        readOptions
      );

      return () => {
        unsubscribe();
        if (
          manager.getListenerCount(cacheKey) === 0 &&
          manager.peek(cacheKey) === undefined
        ) {
          knownKeys.delete(cacheKey);
        }
      };
    },

    invalidateMentor(mentorId) {
      if (mentorId !== undefined) {
        if (
          typeof mentorId !== 'number' ||
          !Number.isFinite(mentorId) ||
          mentorId <= 0
        ) {
          return;
        }
        const targetMentorId = Math.floor(mentorId);
        let hasActiveSubscriber = false;
        for (const [cacheKey, parsed] of Array.from(knownKeys.entries())) {
          if (parsed.mentorId === targetMentorId) {
            if (invalidateOrRefreshSlice(cacheKey, parsed)) {
              hasActiveSubscriber = true;
            }
          }
        }
        if (!hasActiveSubscriber) {
          mentorState.delete(targetMentorId);
        }
        return;
      }

      const activeMentors = new Set<number>();
      for (const [cacheKey, parsed] of Array.from(knownKeys.entries())) {
        if (invalidateOrRefreshSlice(cacheKey, parsed)) {
          activeMentors.add(parsed.mentorId);
        }
      }
      for (const trackedMentorId of Array.from(mentorState.keys())) {
        if (!activeMentors.has(trackedMentorId)) {
          mentorState.delete(trackedMentorId);
        }
      }
    },

    clear() {
      knownKeys.clear();
      mentorState.clear();
      manager.clear();
    },
  };
}

export const mentorFeedbackReadModel: MentorFeedbackReadModel =
  createMentorFeedbackReadModel();

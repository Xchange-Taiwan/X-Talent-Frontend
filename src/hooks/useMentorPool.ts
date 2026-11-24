'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import {
  countActiveMentorPoolFilters,
  DEFAULT_MENTOR_PAGE_LIMIT,
  type MentorPoolQuery,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  type SearchParamReader,
  serializeMentorPoolQuery,
} from '@/lib/mentor/mentorPoolQuery';
import {
  applyMentorPage,
  type MentorPageAction,
  type MentorPoolPageState,
  mentorPoolReadModel,
  type MentorPoolSSRSeed,
} from '@/lib/mentor/mentorPoolReadModel';
import type { MentorType } from '@/types/mentor';

export { applyMentorPage, type MentorPageAction, type MentorPoolPageState };

export interface UseMentorPoolProps {
  initialMentors: MentorType[];
  initialNextCursor?: string | null;
  initialMentorCount: number;
  query?: Readonly<MentorPoolQuery>;
  queryKey?: string;
  params?: SearchParamReader | string | null;
  initialError?: boolean;
}

export function useMentorPool({
  initialMentors,
  initialNextCursor = null,
  initialMentorCount,
  query: providedQuery,
  queryKey: providedQueryKey,
  params,
  initialError,
}: UseMentorPoolProps) {
  const { toast } = useToast();

  const showErrorToast = useCallback(() => {
    toast({
      variant: 'destructive',
      title: '載入失敗',
      description: '無法獲取導師，請稍後再試。',
      duration: 5000,
    });
  }, [toast]);

  const rawQuery =
    providedQuery !== undefined ? providedQuery : parseMentorPoolQuery(params);
  const queryKey =
    providedQueryKey !== undefined
      ? providedQueryKey
      : serializeMentorPoolQuery(rawQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey canonically determines normalized query
  const query = useMemo(() => normalizeMentorPoolQuery(rawQuery), [queryKey]);
  const initialQueryRef = useRef(query);

  const ssrSeed = useMemo<MentorPoolSSRSeed>(
    () => ({
      initialMentors,
      initialNextCursor,
      initialMentorCount,
      initialError,
      initialQuery: initialQueryRef.current,
    }),
    [initialMentors, initialNextCursor, initialMentorCount, initialError]
  );

  const ssrSeedRef = useRef(ssrSeed);
  ssrSeedRef.current = ssrSeed;

  // Client-only SSR hydration & prop-update sync: never mutates the singleton
  // during SSR render ([DEPLOY-04]), while priming/updating the unfiltered slot
  // and clearing any stale transient SSR error when `ssrSeed` updates on a mounted hook.
  useEffect(() => {
    mentorPoolReadModel.primeUnfilteredFromSSR(ssrSeed);
  }, [ssrSeed]);

  const showErrorToastRef = useRef(showErrorToast);
  showErrorToastRef.current = showErrorToast;

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      mentorPoolReadModel.subscribeSnapshot(query, onStoreChange, {
        ssrSeed: ssrSeedRef.current,
        limit: DEFAULT_MENTOR_PAGE_LIMIT,
        onError: () => showErrorToastRef.current(),
      }),
    [query]
  );

  const getSnapshot = useCallback(
    () => mentorPoolReadModel.getSnapshot(query, ssrSeed),
    [query, ssrSeed]
  );

  const getServerSnapshot = useCallback(
    () => mentorPoolReadModel.getServerSnapshot(query, ssrSeed),
    [query, ssrSeed]
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const handleScrollToBottom = useCallback(async () => {
    if (!snapshot.hasMore || snapshot.isLoading) return;
    const outcome = await mentorPoolReadModel.loadMore(query, {
      limit: DEFAULT_MENTOR_PAGE_LIMIT,
      fallbackState: snapshot,
    });
    if (outcome.status === 'error' && !outcome.deduplicated) {
      showErrorToast();
    }
  }, [query, snapshot, showErrorToast]);

  const handleRetry = useCallback(() => {
    void mentorPoolReadModel.retry(query, {
      limit: DEFAULT_MENTOR_PAGE_LIMIT,
    });
  }, [query]);

  const lastTrackedSearchKeyRef = useRef<string | null>(null);
  const hasKeyword = Boolean(query.search_pattern);
  const activeFilterCount = countActiveMentorPoolFilters(query);

  useEffect(() => {
    if (!hasKeyword && activeFilterCount === 0) {
      lastTrackedSearchKeyRef.current = null;
      return;
    }
    if (snapshot.isLoading || snapshot.hasError) return;
    if (snapshot.listStatus !== 'success' && snapshot.listStatus !== 'empty') {
      return;
    }

    if (lastTrackedSearchKeyRef.current === queryKey) return;
    lastTrackedSearchKeyRef.current = queryKey;

    trackEvent({
      name: 'view_search_results',
      feature: 'mentor_pool',
      metadata: {
        result_count: snapshot.mentorCount,
        has_keyword: hasKeyword,
        active_filter_count: activeFilterCount,
      },
    });

    if (snapshot.listStatus === 'empty' || snapshot.mentorCount === 0) {
      trackEvent({
        name: 'mentor_search_zero_results',
        feature: 'mentor_pool',
        metadata: {
          has_keyword: hasKeyword,
          active_filter_count: activeFilterCount,
        },
      });
    }
  }, [
    activeFilterCount,
    hasKeyword,
    queryKey,
    snapshot.hasError,
    snapshot.isLoading,
    snapshot.listStatus,
    snapshot.mentorCount,
  ]);

  return {
    mentors: snapshot.mentors,
    mentorCount: snapshot.mentorCount,
    isLoading: snapshot.isLoading,
    isNoResults: snapshot.isNoResults,
    hasError: snapshot.hasError,
    listStatus: snapshot.listStatus,
    handleScrollToBottom,
    handleRetry,
  };
}

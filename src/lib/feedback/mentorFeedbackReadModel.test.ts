import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';
import type {
  FetchMentorFeedbackParams,
  MentorFeedbackItem,
  MentorFeedbackPage,
} from '@/types/feedback';

import * as readModelModule from './mentorFeedbackReadModel';
import {
  createMentorFeedbackReadModel,
  MENTOR_FEEDBACK_CACHE_TTL_MS,
  sortFeedbackItems,
  toMentorFeedbackCacheKey,
} from './mentorFeedbackReadModel';

function makeItem(
  id: string,
  createdAt: string | number | null,
  overrides: Partial<MentorFeedbackItem> = {}
): MentorFeedbackItem {
  return fromPartial<MentorFeedbackItem>({
    id,
    authorName: '王**',
    rating: 9,
    content: `評論 ${id}`,
    createdAt,
    ...overrides,
  });
}

function makePage(
  overrides: Partial<MentorFeedbackPage> = {}
): MentorFeedbackPage {
  return fromPartial<MentorFeedbackPage>({
    items: [
      makeItem('newer', '2026-10-28T10:00:00Z'),
      makeItem('older', '2026-10-20T10:00:00Z'),
    ],
    totalRatingCount: 2,
    page: 1,
    pageSize: 10,
    ratingAverage: 9.0,
    completedMeetingCount: 15,
    ...overrides,
  });
}

describe('mentorFeedbackReadModel (#888 / #934)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sortFeedbackItems (single-pass normalization)', () => {
    it('sorts items newest-first by createdAt and preserves relative order on identical timestamps', () => {
      const items = [
        makeItem('a-old', '2026-10-18T10:00:00Z'),
        makeItem('b-tie-1', '2026-10-28T10:00:00Z'),
        makeItem('c-mid', '2026-10-25T10:00:00Z'),
        makeItem('d-tie-2', '2026-10-28T10:00:00Z'),
      ];

      const sorted = sortFeedbackItems(items);
      expect(sorted.map((it) => it.id)).toEqual([
        'b-tie-1',
        'd-tie-2',
        'c-mid',
        'a-old',
      ]);
    });

    it('returns a shallow copy without reordering when already descending or when any date is missing', () => {
      const descending = [
        makeItem('first', '2026-10-28T10:00:00Z'),
        makeItem('second', '2026-10-27T10:00:00Z'),
      ];
      expect(sortFeedbackItems(descending).map((it) => it.id)).toEqual([
        'first',
        'second',
      ]);

      const withMissingDate = [
        makeItem('no-date', null),
        makeItem('valid-date', '2026-10-28T10:00:00Z'),
      ];
      expect(sortFeedbackItems(withMissingDate).map((it) => it.id)).toEqual([
        'no-date',
        'valid-date',
      ]);
    });
  });

  it('exposes narrow public surface without normalizeMentorFeedbackPage or zero-caller methods (#934)', () => {
    expect('normalizeMentorFeedbackPage' in readModelModule).toBe(false);

    const model = createMentorFeedbackReadModel();
    expect(typeof model.subscribe).toBe('function');
    expect(typeof model.peek).toBe('function');
    expect(typeof model.get).toBe('function');
    expect(typeof model.set).toBe('function');
    expect(typeof model.invalidateMentor).toBe('function');
    expect(typeof model.clear).toBe('function');
    expect(typeof model.resolveView).toBe('function');

    expect('getSnapshot' in model).toBe(false);
    expect('prime' in model).toBe(false);
    expect('refresh' in model).toBe(false);
    expect('invalidate' in model).toBe(false);
    expect('hasSubscribers' in model).toBe(false);
  });

  it('normalizes cache keys deterministically with default page=1 and pageSize=10', () => {
    expect(toMentorFeedbackCacheKey({ mentorId: 101 })).toBe('101:1:10');
    expect(
      toMentorFeedbackCacheKey({ mentorId: 101, page: 2, pageSize: 5 })
    ).toBe('101:2:5');
  });

  it('caches fetched pages without redundant re-sorting and deduplicates concurrent subscribers', async () => {
    const model = createMentorFeedbackReadModel();
    const preIngestedItems = [
      makeItem('older-kept-as-ingested', '2026-10-20T10:00:00Z'),
      makeItem('newer-kept-as-ingested', '2026-10-28T10:00:00Z'),
    ];
    const fetcher = vi.fn(async () => makePage({ items: preIngestedItems }));

    const updatesA: AsyncReadResult<MentorFeedbackPage>[] = [];
    const updatesB: AsyncReadResult<MentorFeedbackPage>[] = [];

    const unsubA = model.subscribe({ mentorId: 101, page: 1 }, fetcher, (res) =>
      updatesA.push(res)
    );
    const unsubB = model.subscribe({ mentorId: 101, page: 1 }, fetcher, (res) =>
      updatesB.push(res)
    );

    await vi.waitFor(() => {
      expect(updatesA.at(-1)?.isLoading).toBe(false);
      expect(updatesB.at(-1)?.isLoading).toBe(false);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(updatesA.at(-1)?.data?.items.map((it) => it.id)).toEqual([
      'older-kept-as-ingested',
      'newer-kept-as-ingested',
    ]);
    expect(
      model.get({ mentorId: 101, page: 1 })?.items.map((it) => it.id)
    ).toEqual(['older-kept-as-ingested', 'newer-kept-as-ingested']);

    unsubA();
    unsubB();

    // Subsequent subscriber within TTL hits cache synchronously without refetching
    const updatesCached: AsyncReadResult<MentorFeedbackPage>[] = [];
    const unsubCached = model.subscribe(
      { mentorId: 101, page: 1 },
      fetcher,
      (res) => updatesCached.push(res)
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(updatesCached).toHaveLength(1);
    expect(updatesCached[0]?.isLoading).toBe(false);
    expect(updatesCached[0]?.data?.items[0]?.id).toBe('older-kept-as-ingested');
    unsubCached();
  });

  it('aborts in-flight fetch when the last subscriber unmounts', () => {
    const model = createMentorFeedbackReadModel();
    let capturedSignal: AbortSignal | undefined;

    const unsub = model.subscribe(
      { mentorId: 101, page: 1 },
      (signal) => {
        capturedSignal = signal;
        return new Promise<MentorFeedbackPage>(() => {});
      },
      () => {}
    );

    expect(capturedSignal?.aborted).toBe(false);
    unsub();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('tracks per-mentor summary and retains previous-page items as placeholder data while a sibling page is in flight (#934)', async () => {
    const model = createMentorFeedbackReadModel();
    let resolvePage2: ((value: MentorFeedbackPage) => void) | undefined;

    // Initial uncached mentor 101 has no summary or placeholder items
    expect(
      model.resolveView(
        { mentorId: 101, page: 1, pageSize: 10 },
        { data: null, isLoading: true }
      )
    ).toEqual({
      items: [],
      totalRatingCount: null,
      ratingAverage: null,
      completedMeetingCount: null,
      page: 1,
      pageSize: 10,
      hasLoaded: false,
      isFallbackEmpty: false,
    });

    const page1 = makePage({
      page: 1,
      pageSize: 10,
      totalRatingCount: 12,
      ratingAverage: 9.2,
      completedMeetingCount: 24,
      items: [
        makeItem('p1-item-1', '2026-10-28T10:00:00Z'),
        makeItem('p1-item-2', '2026-10-27T10:00:00Z'),
      ],
    });
    const unsubPage1 = model.subscribe(
      { mentorId: 101, page: 1, pageSize: 10 },
      async () => page1,
      () => {}
    );
    await vi.waitFor(() => {
      expect(model.get({ mentorId: 101, page: 1, pageSize: 10 })).toBeDefined();
    });
    unsubPage1();

    // Synchronous render view for page 2 before effect runs retains page 1 items & summary
    expect(
      model.resolveView(
        { mentorId: 101, page: 2, pageSize: 10 },
        { data: null, isLoading: true }
      )
    ).toEqual({
      items: page1.items,
      totalRatingCount: 12,
      ratingAverage: 9.2,
      completedMeetingCount: 24,
      page: 2,
      pageSize: 10,
      hasLoaded: true,
      isFallbackEmpty: false,
    });

    // Subscribing to in-flight sibling page 2 emits placeholder items & summary while keeping page 2 uncached
    const page2Updates: AsyncReadResult<MentorFeedbackPage>[] = [];
    const unsubPage2 = model.subscribe(
      { mentorId: 101, page: 2, pageSize: 10 },
      () =>
        new Promise<MentorFeedbackPage>((resolve) => {
          resolvePage2 = resolve;
        }),
      (res) => page2Updates.push(res)
    );

    expect(page2Updates[0]).toMatchObject({
      isLoading: true,
      error: null,
      data: {
        page: 2,
        pageSize: 10,
        totalRatingCount: 12,
        ratingAverage: 9.2,
        completedMeetingCount: 24,
        items: page1.items,
      },
    });
    expect(
      model.peek({ mentorId: 101, page: 2, pageSize: 10 })
    ).toBeUndefined();

    // Unrelated mentor 202 never inherits mentor 101's placeholder items or summary
    expect(
      model.resolveView(
        { mentorId: 202, page: 1, pageSize: 10 },
        { data: null, isLoading: true }
      )
    ).toMatchObject({
      items: [],
      totalRatingCount: null,
      hasLoaded: false,
    });

    const page2 = makePage({
      page: 2,
      pageSize: 10,
      totalRatingCount: 13,
      ratingAverage: 9.3,
      completedMeetingCount: 25,
      items: [makeItem('p2-item-1', '2026-10-20T10:00:00Z')],
    });
    resolvePage2?.(page2);

    await vi.waitFor(() => {
      expect(page2Updates.at(-1)?.isLoading).toBe(false);
    });
    expect(page2Updates.at(-1)?.data?.items.map((it) => it.id)).toEqual([
      'p2-item-1',
    ]);
    expect(
      model.resolveView(
        { mentorId: 101, page: 3, pageSize: 10 },
        { data: null, isLoading: true }
      )
    ).toMatchObject({
      items: page2.items,
      totalRatingCount: 13,
      ratingAverage: 9.3,
      completedMeetingCount: 25,
      page: 3,
    });

    unsubPage2();
  });

  describe('invalidateMentor(mentorId?) with injected loadPage port (#934)', () => {
    it('refreshes actively subscribed slices via loadPage without activeFetchers, drops unsubscribed slices, and leaves other mentors untouched', async () => {
      const loadPage = vi.fn(
        async ({ mentorId, page, pageSize }: FetchMentorFeedbackParams) =>
          makePage({
            page: page ?? 1,
            pageSize: pageSize ?? 10,
            totalRatingCount: 10,
            ratingAverage: 9.6,
            completedMeetingCount: 30,
            items: [
              makeItem(
                `m${mentorId}-p${page}-refreshed`,
                '2026-10-30T00:00:00Z'
              ),
            ],
          })
      );
      const model = createMentorFeedbackReadModel({ loadPage });

      model.set(
        { mentorId: 101, page: 1 },
        makePage({ items: [makeItem('m101-p1-v1', '2026-10-20T00:00:00Z')] })
      );
      model.set(
        { mentorId: 101, page: 2 },
        makePage({
          page: 2,
          items: [makeItem('m101-p2-v1', '2026-10-19T00:00:00Z')],
        })
      );
      model.set(
        { mentorId: 202, page: 1 },
        makePage({ items: [makeItem('m202-p1-v1', '2026-10-25T00:00:00Z')] })
      );

      const liveUpdates: AsyncReadResult<MentorFeedbackPage>[] = [];
      const unusedSubscribeFetcher = vi.fn(async () =>
        makePage({
          items: [makeItem('should-not-be-used', '2026-10-01T00:00:00Z')],
        })
      );

      // Subscribe actively to mentor 101 page 2 (hits cache initially)
      const unsub = model.subscribe(
        { mentorId: 101, page: 2, pageSize: 10 },
        unusedSubscribeFetcher,
        (res) => liveUpdates.push(res)
      );
      expect(unusedSubscribeFetcher).toHaveBeenCalledTimes(0);

      // Invalidating invalid mentor IDs is a safe no-op
      model.invalidateMentor(0);
      model.invalidateMentor(-5);
      model.invalidateMentor(Number.NaN);
      expect(model.get({ mentorId: 101, page: 1 })).toBeDefined();

      // Targeted invalidation for mentor 101
      model.invalidateMentor(101);

      // Unsubscribed page 1 of mentor 101 is dropped immediately
      expect(model.get({ mentorId: 101, page: 1 })).toBeUndefined();
      // Unrelated mentor 202 stays cached
      expect(model.get({ mentorId: 202, page: 1 })?.items[0]?.id).toBe(
        'm202-p1-v1'
      );

      // Subscribed page 2 of mentor 101 refreshes directly via loadPage port (not unusedSubscribeFetcher)
      await vi.waitFor(() => {
        expect(loadPage).toHaveBeenCalledTimes(1);
        expect(liveUpdates.at(-1)?.data?.items.map((it) => it.id)).toEqual([
          'm101-p2-refreshed',
        ]);
      });
      expect(unusedSubscribeFetcher).not.toHaveBeenCalled();
      expect(loadPage).toHaveBeenCalledWith({
        mentorId: 101,
        page: 2,
        pageSize: 10,
        signal: expect.any(AbortSignal),
      });
      expect(
        model.resolveView(
          { mentorId: 101, page: 3, pageSize: 10 },
          { data: null, isLoading: true }
        )
      ).toMatchObject({
        totalRatingCount: 10,
        ratingAverage: 9.6,
        completedMeetingCount: 30,
      });

      unsub();
    });

    it('invalidates all mentors and clears unsubscribed mentor summaries when mentorId is omitted', () => {
      const model = createMentorFeedbackReadModel();
      model.set({ mentorId: 101, page: 1 }, makePage({ totalRatingCount: 8 }));
      model.set({ mentorId: 202, page: 1 }, makePage({ totalRatingCount: 6 }));
      model.set({ mentorId: 303, page: 2 }, makePage({ page: 2 }));

      model.invalidateMentor();

      expect(model.get({ mentorId: 101, page: 1 })).toBeUndefined();
      expect(model.get({ mentorId: 202, page: 1 })).toBeUndefined();
      expect(model.get({ mentorId: 303, page: 2 })).toBeUndefined();
      expect(
        model.resolveView(
          { mentorId: 101, page: 1 },
          { data: null, isLoading: true }
        ).hasLoaded
      ).toBe(false);
    });
  });

  it('marks entries stale after MENTOR_FEEDBACK_CACHE_TTL_MS and revalidates in background on subscribe', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));

    const model = createMentorFeedbackReadModel();
    model.set({ mentorId: 101, page: 1 }, makePage({ totalRatingCount: 3 }));

    vi.advanceTimersByTime(MENTOR_FEEDBACK_CACHE_TTL_MS + 1);
    expect(model.get({ mentorId: 101, page: 1 })).toBeUndefined();
    expect(model.peek({ mentorId: 101, page: 1 })?.totalRatingCount).toBe(3);

    const updates: AsyncReadResult<MentorFeedbackPage>[] = [];
    const fetcher = vi.fn(async () => makePage({ totalRatingCount: 4 }));
    const unsub = model.subscribe({ mentorId: 101, page: 1 }, fetcher, (res) =>
      updates.push(res)
    );

    // Serves stale value immediately while launching revalidation
    expect(updates[0]).toMatchObject({
      isLoading: false,
      data: expect.objectContaining({ totalRatingCount: 3 }),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(updates.at(-1)?.data?.totalRatingCount).toBe(4);
    });

    unsub();
  });
});

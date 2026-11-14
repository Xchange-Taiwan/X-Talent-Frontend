import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';
import type { MentorFeedbackItem, MentorFeedbackPage } from '@/types/feedback';

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
  return {
    id,
    authorName: '王**',
    rating: 9,
    content: `評論 ${id}`,
    createdAt,
    ...overrides,
  };
}

function makePage(
  overrides: Partial<MentorFeedbackPage> = {}
): MentorFeedbackPage {
  return {
    items: [
      makeItem('older', '2026-10-20T10:00:00Z'),
      makeItem('newer', '2026-10-28T10:00:00Z'),
    ],
    totalRatingCount: 2,
    page: 1,
    pageSize: 10,
    ratingAverage: 9.0,
    completedMeetingCount: 15,
    ...overrides,
  };
}

describe('mentorFeedbackReadModel (#888)', () => {
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

  it('normalizes cache keys deterministically with default page=1 and pageSize=10', () => {
    expect(toMentorFeedbackCacheKey({ mentorId: 101 })).toBe('101:1:10');
    expect(
      toMentorFeedbackCacheKey({ mentorId: 101, page: 2, pageSize: 5 })
    ).toBe('101:2:5');
  });

  it('caches fetched pages with single-pass sorting and deduplicates concurrent subscribers', async () => {
    const model = createMentorFeedbackReadModel();
    const fetcher = vi.fn(async () => makePage());

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
      'newer',
      'older',
    ]);
    expect(
      model.get({ mentorId: 101, page: 1 })?.items.map((it) => it.id)
    ).toEqual(['newer', 'older']);

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
    expect(updatesCached[0]?.data?.items[0]?.id).toBe('newer');
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

  describe('invalidateMentor(mentorId?) scope', () => {
    it('refreshes actively subscribed slices in place, drops unsubscribed slices for the target mentor, and leaves other mentors untouched', async () => {
      const model = createMentorFeedbackReadModel();

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
      const refreshFetcher = vi.fn(async () =>
        makePage({
          items: [
            makeItem('m101-p1-old', '2026-10-20T00:00:00Z'),
            makeItem('m101-p1-fresh', '2026-10-30T00:00:00Z'),
          ],
        })
      );

      // Subscribe actively to mentor 101 page 1 (hits cache initially)
      const unsub = model.subscribe(
        { mentorId: 101, page: 1 },
        refreshFetcher,
        (res) => liveUpdates.push(res)
      );
      expect(refreshFetcher).toHaveBeenCalledTimes(0);

      // Invalidating invalid mentor IDs is a safe no-op
      model.invalidateMentor(0);
      model.invalidateMentor(-5);
      model.invalidateMentor(Number.NaN);
      expect(model.get({ mentorId: 101, page: 2 })).toBeDefined();

      // Targeted invalidation for mentor 101
      model.invalidateMentor(101);

      // Unsubscribed page 2 of mentor 101 is dropped immediately
      expect(model.get({ mentorId: 101, page: 2 })).toBeUndefined();
      // Unrelated mentor 202 stays cached
      expect(model.get({ mentorId: 202, page: 1 })?.items[0]?.id).toBe(
        'm202-p1-v1'
      );

      // Subscribed page 1 of mentor 101 refreshes in place and delivers sorted result
      await vi.waitFor(() => {
        expect(refreshFetcher).toHaveBeenCalledTimes(1);
        expect(liveUpdates.at(-1)?.data?.items.map((it) => it.id)).toEqual([
          'm101-p1-fresh',
          'm101-p1-old',
        ]);
      });

      unsub();
    });

    it('invalidates all mentors when mentorId is omitted (undefined)', () => {
      const model = createMentorFeedbackReadModel();
      model.set({ mentorId: 101, page: 1 }, makePage());
      model.set({ mentorId: 202, page: 1 }, makePage());
      model.set({ mentorId: 303, page: 2 }, makePage({ page: 2 }));

      model.invalidateMentor();

      expect(model.get({ mentorId: 101, page: 1 })).toBeUndefined();
      expect(model.get({ mentorId: 202, page: 1 })).toBeUndefined();
      expect(model.get({ mentorId: 303, page: 2 })).toBeUndefined();
    });
  });

  it('marks entries stale after MENTOR_FEEDBACK_CACHE_TTL_MS and revalidates in background on subscribe', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));

    const model = createMentorFeedbackReadModel();
    model.set({ mentorId: 101, page: 1 }, makePage({ totalRatingCount: 3 }));

    vi.advanceTimersByTime(MENTOR_FEEDBACK_CACHE_TTL_MS + 1);
    expect(model.get({ mentorId: 101, page: 1 })).toBeUndefined();
    expect(model.getSnapshot({ mentorId: 101, page: 1 })?.isStale).toBe(true);

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

import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncReadResult } from '@/lib/asyncReadManager';
import type { MentorPage, MentorRequest, MentorType } from '@/types/mentor';

import {
  applyMentorPage,
  createMentorPoolReadModel,
  fetchMentorPoolPageOne,
  isUnfilteredMentorPoolQuery,
  type MentorPageFetcher,
  type MentorPoolPageState,
  type MentorPoolQuery,
  mentorPoolReadModel,
  normalizeMentorPoolQuery,
  parseMentorPoolQuery,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
} from './mentorPoolReadModel';

function makeMentor(
  userId: number,
  overrides: Partial<MentorType> = {}
): MentorType {
  return fromPartial<MentorType>({
    user_id: userId,
    name: `Mentor ${userId}`,
    avatar: `https://example.com/avatar-${userId}.png`,
    job_title: 'Senior Engineer',
    company: 'Acme',
    years_of_experience: 'FIVE_TO_TEN',
    location: 'TWN',
    personal_statement: '',
    about: '',
    seniority_level: 'SENIOR',
    industry: 'software_internet',
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: ['skill_react'],
    have_topic: ['topic_career'],
    updated_at: '2026-11-14T00:00:00Z',
    ...overrides,
  });
}

interface InMemoryDatasetEntry {
  query: MentorPoolQuery;
  mentors: MentorType[];
}

/**
 * Deterministic in-memory `MentorPageFetcher` adapter supporting opaque cursor
 * pagination (`cursor:<offset>`), request logging, and AbortSignal inspection.
 */
function createInMemoryMentorPageFetcher(
  dataset: ReadonlyArray<InMemoryDatasetEntry>
): {
  fetchPage: MentorPageFetcher;
  requests: MentorRequest[];
} {
  const requests: MentorRequest[] = [];

  const fetchPage: MentorPageFetcher = async (request, signal) => {
    requests.push(request);
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const requestQuery = mentorPoolReadModel.internQuery({
      search_pattern: request.search_pattern,
      filter_skills: request.filter_skills,
      filter_topics: request.filter_topics,
      filter_industries: request.filter_industries,
      sort_by: request.sort_by,
    });
    const matched = dataset.find(
      (entry) => mentorPoolReadModel.internQuery(entry.query) === requestQuery
    );
    const allMentors = matched?.mentors ?? [];
    const offset = request.cursor
      ? Number(request.cursor.replace('cursor:', ''))
      : 0;
    const slice = allMentors.slice(offset, offset + request.limit);
    const nextOffset = offset + slice.length;
    const nextCursor =
      slice.length > 0 && nextOffset < allMentors.length
        ? `cursor:${nextOffset}`
        : null;

    return {
      mentors: slice,
      nextCursor,
    };
  };

  return { fetchPage, requests };
}

function createDeferredPageFetcher(): {
  fetchPage: MentorPageFetcher;
  resolve: (page: MentorPage) => void;
  reject: (err: Error) => void;
  wasAborted: () => boolean;
  calls: () => number;
} {
  let resolveFn: (page: MentorPage) => void = () => {};
  let rejectFn: (err: Error) => void = () => {};
  let aborted = false;
  let callCount = 0;

  const promise = new Promise<MentorPage>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    fetchPage: (_req, signal) => {
      callCount += 1;
      if (signal.aborted) {
        aborted = true;
      } else {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
      }
      return promise;
    },
    resolve: (page) => resolveFn(page),
    reject: (err) => rejectFn(err),
    wasAborted: () => aborted,
    calls: () => callCount,
  };
}

describe('mentorPoolReadModel', () => {
  afterEach(() => {
    mentorPoolReadModel.clear();
  });

  describe('canonical MentorPoolQuery interning (#897)', () => {
    it('maps empty, whitespace, and tracking-only URL params to UNFILTERED_MENTOR_POOL_QUERY singleton', () => {
      expect(mentorPoolReadModel.internQuery()).toBe(
        UNFILTERED_MENTOR_POOL_QUERY
      );
      expect(
        mentorPoolReadModel.internQuery(UNFILTERED_MENTOR_POOL_QUERY)
      ).toBe(UNFILTERED_MENTOR_POOL_QUERY);
      expect(mentorPoolReadModel.internQuery({ search_pattern: '   ' })).toBe(
        UNFILTERED_MENTOR_POOL_QUERY
      );
      expect(
        mentorPoolReadModel.resolveQuery(
          '?utm_source=discord&utm_medium=social&fbclid=abc123'
        )
      ).toBe(UNFILTERED_MENTOR_POOL_QUERY);
      expect(
        isUnfilteredMentorPoolQuery(
          parseMentorPoolQuery(new URLSearchParams('utm_campaign=launch'))
        )
      ).toBe(true);
    });

    it('interns canonically equivalent queries to the exact same frozen object reference across utm_* and reordered params', () => {
      const fromUtmUrl = mentorPoolReadModel.resolveQuery(
        '?utm_source=discord&filter_topics=topic_career&q=react&filter_skills=skill_ts'
      );
      const fromReorderedUrl = mentorPoolReadModel.resolveQuery(
        new URLSearchParams(
          'filter_skills=skill_ts&q=react&filter_topics=topic_career&gclid=999'
        )
      );
      const fromObjectA = mentorPoolReadModel.internQuery({
        filter_topics: 'topic_career',
        search_pattern: 'react',
        filter_skills: 'skill_ts',
      });
      const fromObjectB = mentorPoolReadModel.internQuery({
        search_pattern: 'react',
        filter_skills: 'skill_ts',
        filter_topics: 'topic_career',
      });

      expect(Object.isFrozen(fromObjectA)).toBe(true);
      expect(fromUtmUrl).toBe(fromObjectA);
      expect(fromReorderedUrl).toBe(fromObjectA);
      expect(fromObjectB).toBe(fromObjectA);
    });

    it('normalizes comma-separated filter values and strips empty filter values into identical interned references', () => {
      const queryA = normalizeMentorPoolQuery({
        search_pattern: 'react',
        filter_skills: 'skill_ts, skill_react',
        filter_topics: '',
      });
      const queryB = normalizeMentorPoolQuery({
        search_pattern: 'react',
        filter_skills: 'skill_react,skill_ts',
      });

      expect(mentorPoolReadModel.internQuery(queryA)).toBe(
        mentorPoolReadModel.internQuery(queryB)
      );
      expect(toMentorRequest(queryA, { limit: 9 })).toEqual({
        search_pattern: 'react',
        filter_skills: 'skill_react,skill_ts',
        limit: 9,
      });
    });

    it('percent-encodes delimiters internally so crafted values never collide across distinct fields', () => {
      const model = createMentorPoolReadModel();
      const injected = model.internQuery({
        search_pattern: 'a&filter_skills=b',
      });
      const separate = model.internQuery({
        filter_skills: 'b',
        search_pattern: 'a',
      });

      expect(injected).not.toBe(separate);

      model.set(injected, {
        mentors: [makeMentor(1)],
        nextCursor: null,
        hasMore: false,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });
      expect(model.get(separate)).toBeUndefined();
    });
  });

  describe('stateless resolveSSRInitialData & primeUnfilteredFromSSR (#897)', () => {
    it('builds SSR initial data purely without mutating the read model cache across consecutive SSR calls', () => {
      const model = createMentorPoolReadModel();
      const mentorA = makeMentor(1, { name: 'Warm SSR Mentor A' });
      const mentorB = makeMentor(2, { name: 'Revalidated SSR Mentor B' });

      const firstSsrState = model.resolveSSRInitialData(
        UNFILTERED_MENTOR_POOL_QUERY,
        {
          initialMentors: [mentorA],
          initialNextCursor: 'cursor:1',
          initialMentorCount: 1,
        }
      );
      expect(firstSsrState?.mentors[0].name).toBe('Warm SSR Mentor A');
      expect(firstSsrState?.hasMore).toBe(true);
      expect(model.get(UNFILTERED_MENTOR_POOL_QUERY)).toBeUndefined();

      const secondSsrState = model.resolveSSRInitialData(
        UNFILTERED_MENTOR_POOL_QUERY,
        {
          initialMentors: [mentorB],
          initialNextCursor: null,
          initialMentorCount: 1,
        }
      );
      expect(secondSsrState?.mentors[0].name).toBe('Revalidated SSR Mentor B');
      expect(secondSsrState?.hasMore).toBe(false);
      expect(model.get(UNFILTERED_MENTOR_POOL_QUERY)).toBeUndefined();
    });

    it('primes the unfiltered slot via primeUnfilteredFromSSR without overwriting existing fresh client data', () => {
      const model = createMentorPoolReadModel();
      const ssrMentor = makeMentor(1, { name: 'SSR Seed' });
      const freshClientMentor = makeMentor(2, { name: 'Fresh Client' });

      model.primeUnfilteredFromSSR({
        initialMentors: [ssrMentor],
        initialNextCursor: null,
        initialMentorCount: 1,
        initialQuery: { search_pattern: 'react' },
      });

      expect(model.get(UNFILTERED_MENTOR_POOL_QUERY)?.mentors[0].name).toBe(
        'SSR Seed'
      );

      model.set(UNFILTERED_MENTOR_POOL_QUERY, {
        mentors: [freshClientMentor],
        nextCursor: null,
        hasMore: false,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });

      // Subsequent primeUnfilteredFromSSR must respect ifEmpty and leave freshClientMentor intact
      model.primeUnfilteredFromSSR({
        initialMentors: [ssrMentor],
        initialNextCursor: null,
        initialMentorCount: 1,
      });

      expect(model.get(UNFILTERED_MENTOR_POOL_QUERY)?.mentors[0].name).toBe(
        'Fresh Client'
      );
    });

    it('holds transient SSR initialError only until unsubscribe or force retry, never permanently polluting unfiltered cache', async () => {
      const model = createMentorPoolReadModel();
      model.primeUnfilteredFromSSR({
        initialMentors: [],
        initialMentorCount: 0,
        initialError: true,
        initialQuery: UNFILTERED_MENTOR_POOL_QUERY,
      });

      let fetchCalls = 0;
      const updates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsub = model.subscribe(
        UNFILTERED_MENTOR_POOL_QUERY,
        async () => {
          fetchCalls += 1;
          return {
            mentors: [makeMentor(9)],
            nextCursor: null,
            hasMore: false,
            mentorCount: 1,
            isNoResults: false,
            hasError: false,
          };
        },
        (res) => updates.push(res)
      );

      // Serves error state without calling fetcher on mount
      expect(fetchCalls).toBe(0);
      expect(updates).toHaveLength(1);
      expect(updates[0].data?.hasError).toBe(true);

      // Navigating away (unsubscribing) drops the transient SSR error
      unsub();

      const freshUpdates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsub2 = model.subscribe(
        UNFILTERED_MENTOR_POOL_QUERY,
        async () => {
          fetchCalls += 1;
          return {
            mentors: [makeMentor(9)],
            nextCursor: null,
            hasMore: false,
            mentorCount: 1,
            isNoResults: false,
            hasError: false,
          };
        },
        (res) => freshUpdates.push(res)
      );

      await vi.waitFor(() => {
        expect(freshUpdates.at(-1)?.data?.mentors[0].user_id).toBe(9);
      });
      expect(fetchCalls).toBe(1);
      unsub2();
    });

    it('does not re-arm SSR initialError on repeated primeUnfilteredFromSSR calls once client-side fetches have occurred, while surviving StrictMode remounts on initial mount', async () => {
      const model = createMentorPoolReadModel();
      const ssrErrorSeed = {
        initialMentors: [],
        initialMentorCount: 0,
        initialError: true,
        initialQuery: UNFILTERED_MENTOR_POOL_QUERY,
      };

      // Simulate React 18 StrictMode: mount -> cleanup -> remount before any client fetch
      model.primeUnfilteredFromSSR(ssrErrorSeed);
      let unfilteredFetchCalls = 0;
      const unsubStrict1 = model.subscribe(
        UNFILTERED_MENTOR_POOL_QUERY,
        async () => {
          unfilteredFetchCalls += 1;
          return {
            mentors: [makeMentor(1)],
            nextCursor: null,
            hasMore: false,
            mentorCount: 1,
            isNoResults: false,
            hasError: false,
          };
        },
        () => {}
      );
      unsubStrict1();

      model.primeUnfilteredFromSSR(ssrErrorSeed);
      const strictUpdates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsubStrict2 = model.subscribe(
        UNFILTERED_MENTOR_POOL_QUERY,
        async () => {
          unfilteredFetchCalls += 1;
          return {
            mentors: [makeMentor(1)],
            nextCursor: null,
            hasMore: false,
            mentorCount: 1,
            isNoResults: false,
            hasError: false,
          };
        },
        (res) => strictUpdates.push(res)
      );
      expect(unfilteredFetchCalls).toBe(0);
      expect(strictUpdates[0]?.data?.hasError).toBe(true);

      // Navigate to a filtered query (simulating rerender with inline initialMentors=[])
      unsubStrict2();
      model.primeUnfilteredFromSSR({
        ...ssrErrorSeed,
        initialMentors: [],
      });
      const filteredQuery = model.resolveQuery('?q=react');
      const unsubFiltered = model.subscribe(
        filteredQuery,
        async () => ({
          mentors: [makeMentor(2)],
          nextCursor: null,
          hasMore: false,
          mentorCount: 1,
          isNoResults: false,
          hasError: false,
        }),
        () => {}
      );
      await vi.waitFor(() => {
        expect(model.get(filteredQuery)?.mentors[0].user_id).toBe(2);
      });
      unsubFiltered();

      // Clear filters back to unfiltered while parent re-renders with fresh initialMentors=[]
      expect(
        model.resolveSSRInitialData(UNFILTERED_MENTOR_POOL_QUERY, {
          ...ssrErrorSeed,
          initialMentors: [],
        })
      ).toBeUndefined();
      model.primeUnfilteredFromSSR({
        ...ssrErrorSeed,
        initialMentors: [],
      });

      const clearedUpdates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsubCleared = model.subscribe(
        UNFILTERED_MENTOR_POOL_QUERY,
        async () => {
          unfilteredFetchCalls += 1;
          return {
            mentors: [makeMentor(3)],
            nextCursor: null,
            hasMore: false,
            mentorCount: 1,
            isNoResults: false,
            hasError: false,
          };
        },
        (res) => clearedUpdates.push(res)
      );

      await vi.waitFor(() => {
        expect(clearedUpdates.at(-1)?.data?.mentors[0].user_id).toBe(3);
      });
      expect(unfilteredFetchCalls).toBe(1);
      expect(clearedUpdates.at(-1)?.data?.hasError).toBe(false);
      unsubCleared();
    });

    it('sets hasMore=false when initialMentors is empty even if initialNextCursor is non-empty', () => {
      const state = mentorPoolReadModel.buildInitialUnfilteredState({
        initialMentors: [],
        initialNextCursor: 'opaque-stale-cursor',
        initialMentorCount: 0,
        hasInitialFilters: false,
      });

      expect(state.nextCursor).toBe('opaque-stale-cursor');
      expect(state.hasMore).toBe(false);
      expect(state.isNoResults).toBe(true);
    });

    it('suppresses initialError when hasInitialFilters is true', () => {
      const state = mentorPoolReadModel.buildInitialUnfilteredState({
        initialMentors: [],
        initialMentorCount: 0,
        hasInitialFilters: true,
        initialError: true,
      });

      expect(state.hasError).toBe(false);
    });
  });

  describe('subscribe, cache reuse, and raw subject_group code preservation', () => {
    it('hits the same cache slot across utm_* and reordered query params without duplicate fetches', async () => {
      const { fetchPage, requests } = createInMemoryMentorPageFetcher([
        {
          query: {
            search_pattern: 'react',
            filter_skills: 'skill_fe',
          },
          mentors: [
            makeMentor(1, {
              have_topic: ['topic_architecture'],
              have_skill: ['skill_fe'],
            }),
          ],
        },
      ]);

      const queryWithUtm = mentorPoolReadModel.resolveQuery(
        '?utm_source=discord&filter_skills=skill_fe&q=react'
      );
      const updates1: AsyncReadResult<MentorPoolPageState>[] = [];

      const unsub1 = mentorPoolReadModel.subscribe(
        queryWithUtm,
        (sig) => fetchMentorPoolPageOne(queryWithUtm, fetchPage, sig, 9),
        (res) => updates1.push(res)
      );

      await vi.waitFor(() => {
        expect(updates1).toHaveLength(2);
      });
      unsub1();

      expect(requests).toHaveLength(1);
      // MentorType preserves wire-normalized raw subject_group codes
      expect(updates1[1].data?.mentors[0].have_topic).toEqual([
        'topic_architecture',
      ]);
      expect(updates1[1].data?.mentors[0].have_skill).toEqual(['skill_fe']);

      // Subscribe with reordered params and no utm_source -> synchronous cache hit!
      const cleanReorderedQuery = mentorPoolReadModel.resolveQuery(
        '?q=react&filter_skills=skill_fe'
      );
      expect(cleanReorderedQuery).toBe(queryWithUtm);

      const updates2: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsub2 = mentorPoolReadModel.subscribe(
        cleanReorderedQuery,
        (sig) => fetchMentorPoolPageOne(cleanReorderedQuery, fetchPage, sig, 9),
        (res) => updates2.push(res)
      );

      expect(updates2).toHaveLength(1);
      expect(updates2[0].isLoading).toBe(false);
      expect(updates2[0].data?.mentors[0].user_id).toBe(1);
      expect(requests).toHaveLength(1);

      unsub2();
    });
  });

  describe('loadMore cursor pagination, deduplication, cancellation, and progress guards', () => {
    it('paginates with opaque cursors via InMemoryMentorPageFetcher and publishes appended pages to subscribers', async () => {
      const allMentors = [
        makeMentor(1),
        makeMentor(2),
        makeMentor(3),
        makeMentor(4),
        makeMentor(5),
      ];
      const { fetchPage, requests } = createInMemoryMentorPageFetcher([
        { query: { search_pattern: 'react' }, mentors: allMentors },
      ]);

      const query = { search_pattern: 'react' };
      const updates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsub = mentorPoolReadModel.subscribe(
        query,
        (sig) => fetchMentorPoolPageOne(query, fetchPage, sig, 2),
        (res) => updates.push(res)
      );

      await vi.waitFor(() => {
        expect(mentorPoolReadModel.get(query)?.mentors).toHaveLength(2);
      });
      expect(mentorPoolReadModel.get(query)?.nextCursor).toBe('cursor:2');
      expect(mentorPoolReadModel.get(query)?.hasMore).toBe(true);

      const page2 = await mentorPoolReadModel.loadMore(query, fetchPage, {
        limit: 2,
      });
      expect(page2.status).toBe('appended');
      expect(page2.data?.mentors.map((m) => m.user_id)).toEqual([1, 2, 3, 4]);
      expect(page2.data?.nextCursor).toBe('cursor:4');
      expect(page2.data?.hasMore).toBe(true);

      const page3 = await mentorPoolReadModel.loadMore(query, fetchPage, {
        limit: 2,
      });
      expect(page3.status).toBe('appended');
      expect(page3.data?.mentors.map((m) => m.user_id)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      expect(page3.data?.nextCursor).toBeNull();
      expect(page3.data?.hasMore).toBe(false);

      // Further loadMore calls are no-ops once hasMore is false
      const noopResult = await mentorPoolReadModel.loadMore(query, fetchPage, {
        limit: 2,
      });
      expect(noopResult.status).toBe('noop');
      expect(requests).toHaveLength(3);
      expect(updates.at(-1)?.data?.mentors).toHaveLength(5);

      unsub();
    });

    it('deduplicates concurrent loadMore calls for canonically equivalent queries', async () => {
      const deferred = createDeferredPageFetcher();
      mentorPoolReadModel.set(
        { search_pattern: 'react' },
        {
          mentors: [makeMentor(1)],
          nextCursor: 'cursor:1',
          hasMore: true,
          mentorCount: 1,
          isNoResults: false,
          hasError: false,
        }
      );

      const p1 = mentorPoolReadModel.loadMore(
        parseMentorPoolQuery('?utm_source=discord&q=react'),
        deferred.fetchPage
      );
      const p2 = mentorPoolReadModel.loadMore(
        parseMentorPoolQuery('?q=react'),
        deferred.fetchPage
      );

      expect(deferred.calls()).toBe(1);

      deferred.resolve({
        mentors: [makeMentor(2)],
        nextCursor: null,
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.status).toBe('appended');
      expect(res1.deduplicated).toBeUndefined();
      expect(res2.status).toBe('appended');
      expect(res2.deduplicated).toBe(true);
      expect(
        mentorPoolReadModel
          .get({ search_pattern: 'react' })
          ?.mentors.map((m) => m.user_id)
      ).toEqual([1, 2]);
    });

    it('aborts only the departed query loadMore when its last subscriber unsubscribes, leaving other queries intact', async () => {
      const deferredReact = createDeferredPageFetcher();
      const deferredVue = createDeferredPageFetcher();

      const reactQuery = { search_pattern: 'react' };
      const vueQuery = { search_pattern: 'vue' };

      mentorPoolReadModel.set(reactQuery, {
        mentors: [makeMentor(1)],
        nextCursor: 'cursor:react-2',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });
      mentorPoolReadModel.set(vueQuery, {
        mentors: [makeMentor(10)],
        nextCursor: 'cursor:vue-2',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });

      const unsubReact = mentorPoolReadModel.subscribe(
        reactQuery,
        () => Promise.reject(new Error('should hit cache')),
        () => {}
      );
      const unsubVue = mentorPoolReadModel.subscribe(
        vueQuery,
        () => Promise.reject(new Error('should hit cache')),
        () => {}
      );

      const reactLoadMore = mentorPoolReadModel.loadMore(
        reactQuery,
        deferredReact.fetchPage
      );
      const vueLoadMore = mentorPoolReadModel.loadMore(
        vueQuery,
        deferredVue.fetchPage
      );

      expect(deferredReact.wasAborted()).toBe(false);
      expect(deferredVue.wasAborted()).toBe(false);

      // User navigates away from reactQuery -> last reactQuery subscriber leaves
      unsubReact();

      expect(deferredReact.wasAborted()).toBe(true);
      expect(deferredVue.wasAborted()).toBe(false);

      // Even if react's fetcher ignores AbortSignal and resolves late, it must not mutate cache
      deferredReact.resolve({
        mentors: [makeMentor(99)],
        nextCursor: 'cursor:react-3',
      });
      deferredVue.resolve({
        mentors: [makeMentor(11)],
        nextCursor: null,
      });

      const [reactOutcome, vueOutcome] = await Promise.all([
        reactLoadMore,
        vueLoadMore,
      ]);

      expect(reactOutcome.status).toBe('aborted');
      expect(
        mentorPoolReadModel.get(reactQuery)?.mentors.map((m) => m.user_id)
      ).toEqual([1]);

      expect(vueOutcome.status).toBe('appended');
      expect(
        mentorPoolReadModel.get(vueQuery)?.mentors.map((m) => m.user_id)
      ).toEqual([10, 11]);

      unsubVue();
    });

    it('enforces #1217 opaque-cursor progress guards on unchanged cursor, duplicate-only page, and empty page', async () => {
      const query = { search_pattern: 'guards' };
      const base: MentorPoolPageState = {
        mentors: [makeMentor(1)],
        nextCursor: 'opaque-same',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      };

      // 1. Unchanged cursor stops pagination to prevent infinite loop
      mentorPoolReadModel.set(query, base);
      const unchangedOutcome = await mentorPoolReadModel.loadMore(
        query,
        async () => ({
          mentors: [makeMentor(2)],
          nextCursor: 'opaque-same',
        })
      );
      expect(unchangedOutcome.status).toBe('appended');
      expect(unchangedOutcome.data?.mentors.map((m) => m.user_id)).toEqual([
        1, 2,
      ]);
      expect(unchangedOutcome.data?.hasMore).toBe(false);

      // 2. Duplicate-only mentors stop pagination and preserve array reference
      mentorPoolReadModel.set(query, base);
      const duplicateOutcome = await mentorPoolReadModel.loadMore(
        query,
        async () => ({
          mentors: [makeMentor(1)],
          nextCursor: 'opaque-next',
        })
      );
      expect(duplicateOutcome.status).toBe('appended');
      expect(duplicateOutcome.data?.mentors).toBe(base.mentors);
      expect(duplicateOutcome.data?.mentorCount).toBe(1);
      expect(duplicateOutcome.data?.hasMore).toBe(false);

      // 3. Empty page with non-null cursor stops pagination
      mentorPoolReadModel.set(query, base);
      const emptyOutcome = await mentorPoolReadModel.loadMore(
        query,
        async () => ({
          mentors: [],
          nextCursor: 'opaque-next',
        })
      );
      expect(emptyOutcome.status).toBe('appended');
      expect(emptyOutcome.data?.mentors).toBe(base.mentors);
      expect(emptyOutcome.data?.hasMore).toBe(false);
    });

    it('preserves hasMore and nextCursor on loadMore failure so retrying succeeds from the same cursor', async () => {
      const query = { search_pattern: 'retry-scroll' };
      mentorPoolReadModel.set(query, {
        mentors: [makeMentor(1)],
        nextCursor: 'cursor:1',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });

      const updates: AsyncReadResult<MentorPoolPageState>[] = [];
      const unsub = mentorPoolReadModel.subscribe(
        query,
        () => Promise.reject(new Error('should hit cache')),
        (res) => updates.push(res)
      );

      const failed = await mentorPoolReadModel.loadMore(query, async () => {
        throw new Error('Temporary 503');
      });

      expect(failed.status).toBe('error');
      if (failed.status === 'error') {
        expect(failed.error).toBe('Temporary 503');
      }
      expect(updates.at(-1)?.isLoading).toBe(false);
      expect(mentorPoolReadModel.get(query)?.hasMore).toBe(true);
      expect(mentorPoolReadModel.get(query)?.nextCursor).toBe('cursor:1');
      expect(mentorPoolReadModel.get(query)?.hasError).toBe(false);

      // Retry loadMore -> uses preserved 'cursor:1' and appends cleanly
      const seenCursors: Array<string | undefined> = [];
      const retried = await mentorPoolReadModel.loadMore(query, async (req) => {
        seenCursors.push(req.cursor);
        return {
          mentors: [makeMentor(2)],
          nextCursor: null,
        };
      });

      expect(seenCursors).toEqual(['cursor:1']);
      expect(retried.status).toBe('appended');
      expect(
        mentorPoolReadModel.get(query)?.mentors.map((m) => m.user_id)
      ).toEqual([1, 2]);

      unsub();
    });

    it('aborts loadMore cleanly even if clear() is invoked synchronously inside fetchPage', async () => {
      const query = { search_pattern: 'sync-clear' };
      mentorPoolReadModel.set(query, {
        mentors: [makeMentor(1)],
        nextCursor: 'cursor:1',
        hasMore: true,
        mentorCount: 1,
        isNoResults: false,
        hasError: false,
      });

      let signalAbortedDuringCall = false;
      const outcome = await mentorPoolReadModel.loadMore(
        query,
        async (_req, signal) => {
          mentorPoolReadModel.clear();
          signalAbortedDuringCall = signal.aborted;
          return { mentors: [makeMentor(2)], nextCursor: null };
        }
      );

      expect(signalAbortedDuringCall).toBe(true);
      expect(outcome.status).toBe('aborted');
      expect(mentorPoolReadModel.get(query)).toBeUndefined();
    });
  });

  describe('applyMentorPage', () => {
    it('applyMentorPage respects explicit totalCount on replace', () => {
      const state = applyMentorPage(
        {
          mentors: [],
          nextCursor: null,
          hasMore: true,
          mentorCount: 0,
          isNoResults: false,
          hasError: false,
        },
        {
          type: 'replace',
          page: { mentors: [makeMentor(1)], nextCursor: 'c2' },
          totalCount: 42,
        }
      );

      expect(state.mentorCount).toBe(42);
      expect(state.hasMore).toBe(true);
    });
  });
});

import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import {
  normalizePositiveUserId,
  resolveProfileUserId,
} from '@/lib/profile/userId';
import type { MentorProfileVO } from '@/types/user';

import {
  createProfileReadModel,
  createStaleMentorRefetchBudget,
  isStaleMentorDto,
  OPTIMISTIC_TRANSITION_WINDOW_MS,
  parseProfileCacheKey,
  PROFILE_READ_MODEL_TTL_MS,
  profileReadModel,
  resolveMentorAwareSeed,
} from './profileReadModel';

const makeDto = (
  userId: number,
  overrides: Partial<MentorProfileVO> = {}
): MentorProfileVO =>
  fromPartial<MentorProfileVO>({
    user_id: userId,
    name: `User ${userId}`,
    avatar: `https://example.com/u/${userId}.png`,
    is_mentor: false,
    onboarding: true,
    experiences: [],
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [],
    have_topic: [],
    ...overrides,
  });

describe('profileReadModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    profileReadModel.clear();
  });

  afterEach(() => {
    profileReadModel.clear();
    vi.useRealTimers();
  });

  it('deduplicates concurrent reads per { userId, language }, isolates locales, and serves SWR stale snapshots past TTL', async () => {
    const model = createProfileReadModel();
    const zhDto = makeDto(42, { name: 'Ada (ZH)' });
    const enDto = makeDto(42, { name: 'Ada (EN)' });

    let resolveZh!: (dto: MentorProfileVO | null) => void;
    const zhFetcher = vi.fn(
      () =>
        new Promise<MentorProfileVO | null>((resolve) => {
          resolveZh = resolve;
        })
    );
    const enFetcher = vi.fn(async () => enDto);

    const updatesA: Array<MentorProfileVO | null> = [];
    const updatesB: Array<MentorProfileVO | null> = [];
    const unsubA = model.subscribe(
      { userId: 42, language: 'zh_TW' },
      zhFetcher,
      (res) => {
        if (!res.isLoading) updatesA.push(res.data);
      }
    );
    const unsubB = model.subscribe(
      { userId: 42, language: 'zh_TW' },
      zhFetcher,
      (res) => {
        if (!res.isLoading) updatesB.push(res.data);
      }
    );
    const unsubEn = model.subscribe(
      { userId: 42, language: 'en_US' },
      enFetcher,
      () => {}
    );

    expect(zhFetcher).toHaveBeenCalledTimes(1);
    expect(enFetcher).toHaveBeenCalledTimes(1);

    resolveZh(zhDto);
    await vi.waitFor(() => {
      expect(updatesA).toEqual([zhDto]);
      expect(updatesB).toEqual([zhDto]);
    });

    expect(model.get({ userId: 42, language: 'zh_TW' })).toBe(zhDto);
    expect(model.get({ userId: 42, language: 'en_US' })).toBe(enDto);

    unsubA();
    unsubB();
    unsubEn();

    vi.advanceTimersByTime(PROFILE_READ_MODEL_TTL_MS + 1);
    expect(model.get({ userId: 42, language: 'zh_TW' })).toBeUndefined();
    expect(model.peek({ userId: 42, language: 'zh_TW' })).toBe(zhDto);
    expect(model.getSnapshot({ userId: 42, language: 'zh_TW' })).toEqual({
      value: zhDto,
      isStale: true,
    });
  });

  it('invalidates all tracked locales for a single user via invalidateUser(userId) without touching other users', () => {
    const model = createProfileReadModel();
    model.prime({ userId: 42, language: 'zh_TW' }, makeDto(42, { name: 'ZH' }));
    model.prime({ userId: 42, language: 'en_US' }, makeDto(42, { name: 'EN' }));
    model.prime(
      { userId: 99, language: 'zh_TW' },
      makeDto(99, { name: 'Other User' })
    );

    let user42Aborted = 0;
    let user99Aborted = 0;
    const unsub42 = model.subscribe(
      { userId: 42, language: 'ja_JP' },
      (signal) => {
        signal.addEventListener('abort', () => {
          user42Aborted += 1;
        });
        return new Promise<MentorProfileVO | null>(() => {});
      },
      () => {}
    );
    const unsub99 = model.subscribe(
      { userId: 99, language: 'en_US' },
      (signal) => {
        signal.addEventListener('abort', () => {
          user99Aborted += 1;
        });
        return new Promise<MentorProfileVO | null>(() => {});
      },
      () => {}
    );

    model.invalidateUser(42);

    expect(model.peek({ userId: 42, language: 'zh_TW' })).toBeUndefined();
    expect(model.peek({ userId: 42, language: 'en_US' })).toBeUndefined();
    expect(user42Aborted).toBe(1);

    expect(model.get({ userId: 99, language: 'zh_TW' })?.name).toBe(
      'Other User'
    );
    expect(user99Aborted).toBe(0);

    unsub42();
    unsub99();
  });

  it('short-circuits SSR initialData = null without fetching or poisoning cache, while allowing forced retry or later unseeded mounts', async () => {
    const model = createProfileReadModel();
    const key = { userId: 7, language: 'zh_TW' };
    const fetcher = vi.fn(async () => makeDto(7, { name: 'Recovered' }));

    const results: Array<{
      data: MentorProfileVO | null;
      isLoading: boolean;
      error: string | null;
    }> = [];

    const unsubNull = model.subscribe(
      key,
      fetcher,
      (res) => {
        results.push(res);
      },
      { initialData: null }
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(results).toEqual([{ data: null, isLoading: false, error: null }]);
    expect(model.peek(key)).toBeUndefined();

    // Conditional SSR prime with null must also be ignored
    model.prime(key, null, { ifEmpty: true });
    expect(model.peek(key)).toBeUndefined();
    unsubNull();

    // Subsequent normal subscribe (no initialData: null) fetches from network
    const unsubNormal = model.subscribe(key, fetcher, () => {});
    await vi.waitFor(() => {
      expect(model.get(key)?.name).toBe('Recovered');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    unsubNormal();
  });

  it('prioritizes existing cached DTO over stale SSR initialData and avoids starting optimistic window on ifEmpty SSR hydration', () => {
    const model = createProfileReadModel();
    const key = { userId: 8, language: 'zh_TW' };
    const ssrDto = makeDto(8, { name: 'SSR Hydrated' });

    model.prime(key, ssrDto, { ifEmpty: true });
    expect(model.get(key)).toBe(ssrDto);
    expect(model.isOptimisticTransitionActive()).toBe(false);

    const newerCachedDto = makeDto(8, { name: 'Client Primed' });
    model.prime(key, newerCachedDto);
    expect(model.isOptimisticTransitionActive()).toBe(true);
    expect(model.resolveInitialData(key, ssrDto)).toBeUndefined();
  });

  it('protects optimistic primed DTO until backend converges during transition window and evicts on forced null/error refetch', async () => {
    const model = createProfileReadModel();
    const key = { userId: 60, language: 'zh_TW' };
    const primedDto = makeDto(60, {
      name: 'Optimistic Name',
      job_title: 'Staff Engineer',
      company: 'XChange',
      is_mentor: true,
    });
    const staleDto = makeDto(60, {
      name: 'Old Name',
      job_title: 'Junior Engineer',
      company: 'Old Co',
      is_mentor: false,
    });
    const convergedDto = makeDto(60, {
      name: 'Optimistic Name',
      job_title: 'Staff Engineer',
      company: 'XChange',
      is_mentor: true,
    });

    model.prime(key, primedDto);
    model.set(key, primedDto, 1_000);
    vi.advanceTimersByTime(1_001);

    // Entry is stale, but 10s optimistic transition window is still active
    expect(model.isOptimisticTransitionActive()).toBe(true);

    let latest: MentorProfileVO | null = null;
    const unsub1 = model.subscribe(
      key,
      async () => staleDto,
      (res) => {
        latest = res.data;
      }
    );
    await vi.waitFor(() => {
      expect(latest).toBe(primedDto);
    });
    unsub1();

    model.set(key, primedDto, 1_000);
    vi.advanceTimersByTime(1_001);

    const unsub2 = model.subscribe(
      key,
      async () => convergedDto,
      (res) => {
        latest = res.data;
      }
    );
    await vi.waitFor(() => {
      expect(latest).toBe(convergedDto);
    });
    unsub2();

    // Forced manual refetch resolving null evicts cache
    await model.refresh(key, async () => null);
    expect(model.peek(key)).toBeUndefined();
  });

  it('tracks per-instance optimistic identity projection across locales with referential stability and isolated instances', () => {
    const modelA = createProfileReadModel();
    const modelB = createProfileReadModel();

    const observerA = vi.fn();
    const observerOtherUser = vi.fn();
    const unsubA = modelA.observeOptimisticIdentity(123, observerA);
    const unsubOther = modelA.observeOptimisticIdentity(999, observerOtherUser);

    expect(modelA.getOptimisticIdentity(123)).toBeUndefined();

    const { experiences } = encode({
      workExperiences: [],
      educations: [],
      personalLinks: [
        { platform: 'github', url: 'https://github.com/user123' },
      ],
    });

    // Prime under en_US to verify locale-agnostic optimistic identity lookup
    modelA.prime(
      { userId: 123, language: 'en_US' },
      makeDto(123, {
        name: 'Optimistic EN User',
        avatar: 'https://example.com/en.png',
        is_mentor: true,
        onboarding: true,
        job_title: 'Principal Engineer',
        company: 'Acme',
        experiences: toWireExperiences(experiences),
      })
    );

    expect(modelA.isOptimisticTransitionActive()).toBe(true);
    expect(modelB.isOptimisticTransitionActive()).toBe(false);
    expect(observerA).toHaveBeenCalled();

    const firstProjection = modelA.getOptimisticIdentity(123);
    const secondProjection = modelA.getOptimisticIdentity(123);
    expect(firstProjection).toBeDefined();
    expect(secondProjection).toBe(firstProjection);
    expect(firstProjection).toMatchObject({
      name: 'Optimistic EN User',
      avatar: 'https://example.com/en.png',
      isMentor: true,
      onBoarding: true,
      jobTitle: 'Principal Engineer',
      company: 'Acme',
      personalLinks: [
        { platform: 'github', url: 'https://github.com/user123' },
      ],
    });

    // Invalidating an unrelated user keeps user 123's optimistic identity intact
    modelA.invalidateUser(999);
    expect(modelA.isOptimisticTransitionActive()).toBe(true);
    expect(modelA.getOptimisticIdentity(123)).toBe(firstProjection);

    // Expiring the transition window clears getOptimisticIdentity and notifies observer
    const callsBeforeExpiry = observerA.mock.calls.length;
    vi.advanceTimersByTime(OPTIMISTIC_TRANSITION_WINDOW_MS + 1);
    expect(modelA.isOptimisticTransitionActive()).toBe(false);
    expect(modelA.getOptimisticIdentity(123)).toBeUndefined();
    expect(observerA.mock.calls.length).toBeGreaterThan(callsBeforeExpiry);

    unsubA();
    unsubOther();
  });

  it('evaluates shouldCache, notifies transition & key observers, and evicts on forced refresh errors', async () => {
    const model = createProfileReadModel();
    const key = { userId: 88, language: 'zh_TW' };
    const dto = makeDto(88, { name: 'Cached DTO' });
    const updatedDto = makeDto(88, { name: 'Updated DTO' });

    const keyObserver = vi.fn();
    const transitionObserver = vi.fn();
    const unsubKey = model.observe(key, keyObserver);
    const unsubTransition = model.subscribeTransition(transitionObserver);

    vi.setSystemTime(1750000000000);
    model.prime(key, dto);
    expect(model.getLastPrimedTime()).toBe(1750000000000);
    expect(model.isOptimisticTransitionActive()).toBe(true);
    expect(keyObserver).toHaveBeenCalledTimes(1);
    expect(transitionObserver).toHaveBeenCalledTimes(1);

    expect(model.shouldCache(key, dto)).toBe(false);
    expect(model.shouldCache(key, updatedDto)).toBe(true);
    expect(model.shouldCache(key, null)).toBe(false);
    expect(model.shouldCache(null, null)).toBe(false);

    vi.advanceTimersByTime(PROFILE_READ_MODEL_TTL_MS + 1);
    expect(model.shouldCache(key, dto)).toBe(true);

    await expect(
      model.refresh(key, async () => {
        throw new Error('Forced refresh failed');
      })
    ).resolves.toEqual({
      data: null,
      isLoading: false,
      error: 'Forced refresh failed',
    });
    expect(model.peek(key)).toBeUndefined();

    model.invalidate(key);
    expect(model.isOptimisticTransitionActive()).toBe(false);

    unsubKey();
    unsubTransition();
  });

  it('isolates 64-bit string user IDs above Number.MAX_SAFE_INTEGER across cache, optimistic identity, invalidation, and key parsing (#953)', () => {
    expect(normalizePositiveUserId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(normalizePositiveUserId(12.5)).toBeNull();
    expect(normalizePositiveUserId('0123')).toBeNull();
    expect(normalizePositiveUserId('0')).toBeNull();
    expect(normalizePositiveUserId('-1')).toBeNull();
    expect(resolveProfileUserId('123')).toBe(123);
    expect(resolveProfileUserId('9007199254740993')).toBe('9007199254740993');

    const idA = '9007199254740992';
    const idB = '9007199254740993';
    const model = createProfileReadModel();

    expect(parseProfileCacheKey(`${idA}-zh_TW`)).toEqual({
      userId: idA,
      language: 'zh_TW',
    });
    expect(parseProfileCacheKey(`${idB}-zh_TW`)).toEqual({
      userId: idB,
      language: 'zh_TW',
    });
    expect(parseProfileCacheKey('123-zh_TW')).toEqual({
      userId: 123,
      language: 'zh_TW',
    });

    const dtoA = makeDto(1, { name: 'Snowflake A' });
    const dtoB = makeDto(2, { name: 'Snowflake B' });
    const dto123 = makeDto(123, { name: 'Canonical 123' });

    model.prime({ userId: idA, language: 'zh_TW' }, dtoA);
    model.prime({ userId: idB, language: 'zh_TW' }, dtoB);
    model.prime({ userId: 123, language: 'zh_TW' }, dto123);

    expect(model.get({ userId: idA, language: 'zh_TW' })?.name).toBe(
      'Snowflake A'
    );
    expect(model.get({ userId: idB, language: 'zh_TW' })?.name).toBe(
      'Snowflake B'
    );
    expect(model.get({ userId: '123', language: 'zh_TW' })?.name).toBe(
      'Canonical 123'
    );
    expect(model.getOptimisticIdentity(idA)?.name).toBe('Snowflake A');
    expect(model.getOptimisticIdentity(idB)?.name).toBe('Snowflake B');

    model.invalidateUser(idA);
    expect(model.peek({ userId: idA, language: 'zh_TW' })).toBeUndefined();
    expect(model.getOptimisticIdentity(idA)).toBeUndefined();
    expect(model.get({ userId: idB, language: 'zh_TW' })?.name).toBe(
      'Snowflake B'
    );
    expect(model.getOptimisticIdentity(idB)?.name).toBe('Snowflake B');
  });
});

describe('ProfileReadModel expectedIsMentor monotonic guard (#981)', () => {
  const key = { userId: 7, language: 'zh_TW' };

  it('isStaleMentorDto flags only Mentee DTOs when a Mentor is expected', () => {
    expect(isStaleMentorDto(makeDto(7), true)).toBe(true);
    expect(isStaleMentorDto(makeDto(7, { is_mentor: true }), true)).toBe(false);
    expect(isStaleMentorDto(makeDto(7), false)).toBe(false);
    expect(isStaleMentorDto(makeDto(7), undefined)).toBe(false);
    expect(isStaleMentorDto(null, true)).toBe(false);
    expect(isStaleMentorDto(undefined, true)).toBe(false);
  });

  it('resolveMentorAwareSeed discards a stale Mentee SSR seed only when a Mentor is expected', () => {
    const stale = makeDto(7);
    const fresh = makeDto(7, { is_mentor: true });
    expect(resolveMentorAwareSeed(stale, true)).toBeUndefined();
    expect(resolveMentorAwareSeed(stale, false)).toBe(stale);
    expect(resolveMentorAwareSeed(fresh, true)).toBe(fresh);
    expect(resolveMentorAwareSeed(null, true)).toBeNull();
    expect(resolveMentorAwareSeed(undefined, true)).toBeUndefined();
  });

  it('reconcileExpectedMentor force-refetches a stale Mentee DTO at most once per budget and key, then stops (no infinite loop under backend lag)', async () => {
    const model = createProfileReadModel();
    const stale = makeDto(7);
    model.set(key, stale);
    const fetcher = vi.fn().mockResolvedValue(makeDto(7));
    const budget = createStaleMentorRefetchBudget();

    const first = model.reconcileExpectedMentor(
      key,
      stale,
      true,
      fetcher,
      budget
    );
    expect(first).not.toBeNull();
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]).toEqual({ force: true });

    // Backend still lagging: the DTO is still a Mentee but the budget is spent.
    const stillStale = model.peek(key)!;
    expect(
      model.reconcileExpectedMentor(key, stillStale, true, fetcher, budget)
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reconcileExpectedMentor is a no-op for fresh Mentor DTOs, missing DTOs, or when no Mentor is expected', () => {
    const model = createProfileReadModel();
    const fetcher = vi.fn().mockResolvedValue(null);
    const budget = createStaleMentorRefetchBudget();
    expect(
      model.reconcileExpectedMentor(
        key,
        makeDto(7, { is_mentor: true }),
        true,
        fetcher,
        budget
      )
    ).toBeNull();
    expect(
      model.reconcileExpectedMentor(key, null, true, fetcher, budget)
    ).toBeNull();
    expect(
      model.reconcileExpectedMentor(key, makeDto(7), false, fetcher, budget)
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    // Budget was never consumed, so a later stale DTO can still refetch once.
    expect(
      model.reconcileExpectedMentor(key, makeDto(7), true, fetcher, budget)
    ).not.toBeNull();
  });

  it('dedupes concurrent reconcile requests from separate budgets onto one in-flight forced fetch and publishes the fresh DTO to subscribers', async () => {
    const model = createProfileReadModel();
    const stale = makeDto(7);
    model.set(key, stale);
    let resolveFetch!: (dto: MentorProfileVO) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<MentorProfileVO>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const updates: Array<MentorProfileVO | null> = [];
    const unsubscribe = model.subscribe(
      key,
      vi.fn().mockResolvedValue(stale),
      (result) => {
        if (!result.isLoading) updates.push(result.data);
      }
    );

    const pageA = model.reconcileExpectedMentor(
      key,
      stale,
      true,
      fetcher,
      createStaleMentorRefetchBudget()
    );
    const pageB = model.reconcileExpectedMentor(
      key,
      stale,
      true,
      fetcher,
      createStaleMentorRefetchBudget()
    );
    expect(pageA).toBe(pageB);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const fresh = makeDto(7, { is_mentor: true });
    resolveFetch(fresh);
    await pageA;
    expect(model.peek(key)).toBe(fresh);
    expect(updates.at(-1)).toBe(fresh);
    unsubscribe();
  });

  it('scopes the single-attempt budget per cache key so another user still gets one refetch', async () => {
    const model = createProfileReadModel();
    const fetcher = vi.fn().mockResolvedValue(null);
    const budget = createStaleMentorRefetchBudget();
    await model.reconcileExpectedMentor(key, makeDto(7), true, fetcher, budget);
    const otherKey = { userId: 8, language: 'zh_TW' };
    expect(
      model.reconcileExpectedMentor(otherKey, makeDto(8), true, fetcher, budget)
    ).not.toBeNull();
  });
});

import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearUserProfileDtoCache,
  getUserProfileDtoFromCache,
  primeUserProfileDtoCache,
} from '@/lib/cache/userProfileDtoCache';
import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import type { MentorProfileVO } from '@/types/user';

import {
  createProfileReadModel,
  OPTIMISTIC_TRANSITION_WINDOW_MS,
  PROFILE_READ_MODEL_TTL_MS,
  profileReadModel,
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

  it('shares 100% underlying state between singleton profileReadModel and userProfileDtoCache wrappers', () => {
    const dto = makeDto(88, { name: 'Shared Singleton DTO' });

    primeUserProfileDtoCache(88, 'zh_TW', dto);
    expect(profileReadModel.get({ userId: 88, language: 'zh_TW' })).toBe(dto);
    expect(profileReadModel.isOptimisticTransitionActive()).toBe(true);

    profileReadModel.invalidateUser(88);
    expect(getUserProfileDtoFromCache(88, 'zh_TW')).toBeNull();
    expect(profileReadModel.isOptimisticTransitionActive()).toBe(false);

    profileReadModel.prime({ userId: 88, language: 'en_US' }, dto);
    expect(getUserProfileDtoFromCache(88, 'en_US')).toBe(dto);

    clearUserProfileDtoCache(88);
    expect(getUserProfileDtoFromCache(88, 'en_US')).toBeNull();
  });
});

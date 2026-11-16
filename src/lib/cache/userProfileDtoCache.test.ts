import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encode, toWireExperiences } from '@/lib/profile/experienceCodec';
import type { MentorProfileVO } from '@/types/user';

import {
  clearUserProfileDtoCache,
  getEffectiveInitialDto,
  getUserProfileDtoFromCache,
  hasDtoConverged,
  hasProfileDtoConverged,
  isOptimisticTransitionActive,
  primeUserProfileDtoCache,
  resolveUserProfileDtoFetch,
  shouldCacheUserProfileDto,
  subscribeTransition,
  subscribeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  userProfileDtoReadManager,
} from './userProfileDtoCache';

describe('userProfileDtoCache (src/lib/cache)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    userProfileDtoReadManager.clear();
  });

  afterEach(() => {
    userProfileDtoReadManager.clear();
    vi.useRealTimers();
  });

  it('preserves stale DTOs non-destructively past TTL for SWR inspection and skips stale SSR initialData', () => {
    const dto = fromPartial<MentorProfileVO>({
      user_id: 42,
      name: 'Cached Mentor',
    });

    primeUserProfileDtoCache(42, 'zh_TW', dto);
    expect(getUserProfileDtoFromCache(42, 'zh_TW')).toBe(dto);

    vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

    // Expired in strict get(), but preserved for SWR via peek/getSnapshot
    expect(userProfileDtoReadManager.get('42-zh_TW')).toBeUndefined();
    expect(getUserProfileDtoFromCache(42, 'zh_TW')).toBe(dto);
    expect(
      getEffectiveInitialDto(
        '42-zh_TW',
        fromPartial<MentorProfileVO>({ user_id: 42, name: 'Stale SSR' })
      )
    ).toBeUndefined();
  });

  it('cancels competing in-flight reads on primeUserProfileDtoCache and clearUserProfileDtoCache and notifies observers', () => {
    const cacheObserver = vi.fn();
    const transitionObserver = vi.fn();
    const unsubCache = subscribeUserProfileDtoCache(77, 'zh_TW', cacheObserver);
    const unsubTransition = subscribeTransition(transitionObserver);

    let abortedCount = 0;
    const unsubReader = userProfileDtoReadManager.subscribe(
      '77-zh_TW',
      (signal) => {
        signal.addEventListener('abort', () => {
          abortedCount += 1;
        });
        return new Promise<MentorProfileVO | null>(() => {});
      },
      () => {}
    );

    const dto = fromPartial<MentorProfileVO>({
      user_id: 77,
      name: 'Primed User',
    });
    primeUserProfileDtoCache(77, 'zh_TW', dto);

    expect(abortedCount).toBe(1);
    expect(isOptimisticTransitionActive()).toBe(true);
    expect(cacheObserver).toHaveBeenCalledTimes(1);
    expect(transitionObserver).toHaveBeenCalledTimes(1);

    clearUserProfileDtoCache(77, 'zh_TW');

    expect(getUserProfileDtoFromCache(77, 'zh_TW')).toBeNull();
    expect(isOptimisticTransitionActive()).toBe(false);
    expect(cacheObserver).toHaveBeenCalledTimes(2);
    expect(transitionObserver).toHaveBeenCalledTimes(2);

    unsubReader();
    unsubCache();
    unsubTransition();
  });

  describe('shouldCacheUserProfileDto', () => {
    it('returns false for unexpired same-reference DTOs and null, and true for expired or different-reference DTOs', () => {
      const dto = fromPartial<MentorProfileVO>({
        user_id: 50,
        name: 'Cached Mentor',
      });
      const differentDto = fromPartial<MentorProfileVO>({
        user_id: 50,
        name: 'Updated Mentor',
      });

      primeUserProfileDtoCache(50, 'zh_TW', dto);

      expect(shouldCacheUserProfileDto('50-zh_TW', dto)).toBe(false);
      expect(shouldCacheUserProfileDto('50-zh_TW', differentDto)).toBe(true);
      expect(shouldCacheUserProfileDto('50-zh_TW', null)).toBe(false);
      expect(shouldCacheUserProfileDto(null, null)).toBe(false);

      vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

      expect(userProfileDtoReadManager.get('50-zh_TW')).toBeUndefined();
      expect(userProfileDtoReadManager.peek('50-zh_TW')).toBe(dto);
      expect(shouldCacheUserProfileDto('50-zh_TW', dto)).toBe(true);

      clearUserProfileDtoCache(50, 'zh_TW');
    });
  });

  describe('resolveUserProfileDtoFetch', () => {
    it('retains primed DTO during optimistic transition window when incoming DTO has not converged', async () => {
      const primedDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Optimistic Name',
        job_title: 'Staff Engineer',
        company: 'New Corp',
        is_mentor: true,
      });
      const staleIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Stale Name',
        job_title: 'Junior Engineer',
        company: 'Old Corp',
        is_mentor: false,
      });
      const convergedIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Optimistic Name',
        job_title: 'Staff Engineer',
        company: 'New Corp',
        is_mentor: true,
      });

      primeUserProfileDtoCache(60, 'zh_TW', primedDto);
      expect(isOptimisticTransitionActive()).toBe(true);

      const nonConvergedResult = await resolveUserProfileDtoFetch(
        '60-zh_TW',
        async () => staleIncomingDto,
        new AbortController().signal
      );
      expect(nonConvergedResult).toBe(primedDto);

      const convergedResult = await resolveUserProfileDtoFetch(
        '60-zh_TW',
        async () => convergedIncomingDto,
        new AbortController().signal
      );
      expect(convergedResult).toBe(convergedIncomingDto);

      clearUserProfileDtoCache(60, 'zh_TW');
    });

    it('guards every editable scalar, tag bucket, and experience field against stale SWR overwrite during optimistic window', async () => {
      const { experiences } = encode({
        workExperiences: [
          {
            job: 'Principal Engineer',
            company: 'Acme',
            job_period_start: '2022',
            job_period_end: 'now',
            industry: 'tech',
            job_location: 'TWN',
            description: 'Architecture',
            is_primary: true,
          },
        ],
        educations: [
          {
            school: 'NTU',
            subject: 'CS',
            education_period_start: '2014',
            education_period_end: '2018',
          },
        ],
        personalLinks: [
          { platform: 'github', url: 'https://github.com/janedoe' },
        ],
      });

      const primedDto: MentorProfileVO = {
        user_id: 65,
        name: 'Jane Doe',
        avatar: 'https://s3.amazonaws.com/bucket/files/65/avatar?v=1754000000',
        job_title: 'Principal Engineer',
        company: 'Acme',
        years_of_experience: '5_10',
        location: 'TWN',
        onboarding: true,
        is_mentor: true,
        language: 'zh_TW',
        personal_statement: 'Updated statement',
        about: 'Updated about bio',
        seniority_level: null,
        industry: {
          id: 3,
          kind: 'industry',
          subject_group: 'tech',
          subject: '軟體與科技',
        },
        experiences: toWireExperiences(experiences),
        have_skill: ['typescript', 'system_design'],
        have_topic: ['career'],
        want_position: ['staff_engineer'],
        want_skill: ['leadership'],
        want_topic: ['management'],
      };

      primeUserProfileDtoCache(65, 'zh_TW', primedDto);

      const staleMutations: Array<Partial<MentorProfileVO>> = [
        { about: 'Old about bio' },
        { personal_statement: 'Old statement' },
        { location: 'USA' },
        { years_of_experience: '1_3' },
        {
          industry: {
            id: 4,
            kind: 'industry',
            subject_group: 'finance',
            subject: '金融業',
          },
        },
        {
          avatar:
            'https://s3.amazonaws.com/bucket/files/65/avatar?v=1753999999',
        },
        { experiences: [] },
        { have_skill: ['typescript'] },
        { have_topic: [] },
        { want_position: ['junior_engineer'] },
        { want_skill: [] },
        { want_topic: ['interview'] },
      ];

      for (const staleOverride of staleMutations) {
        const staleCandidate: MentorProfileVO = {
          ...primedDto,
          ...staleOverride,
        };
        const result = await resolveUserProfileDtoFetch(
          '65-zh_TW',
          async () => staleCandidate,
          new AbortController().signal
        );
        expect(result).toBe(primedDto);
      }

      const convergedBackendDto: MentorProfileVO = {
        ...primedDto,
        avatar:
          'https://s3.amazonaws.com/bucket/files/65/avatar?v=1754000000&cb=2026-11-16T00%3A00%3A00Z',
        have_skill: ['system_design', 'typescript'],
      };

      const convergedResult = await resolveUserProfileDtoFetch(
        '65-zh_TW',
        async () => convergedBackendDto,
        new AbortController().signal
      );
      expect(convergedResult).toBe(convergedBackendDto);

      clearUserProfileDtoCache(65, 'zh_TW');
    });

    it('retains stale primed DTO via peek() during optimistic transition window when entry TTL has elapsed and incoming DTO has not converged', async () => {
      const primedDto = fromPartial<MentorProfileVO>({
        user_id: 64,
        name: 'Stale Optimistic Name',
        job_title: 'Principal Engineer',
        company: 'Next Corp',
        is_mentor: true,
      });
      const staleIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 64,
        name: 'Old Backend Name',
        job_title: 'Junior Engineer',
        company: 'Old Corp',
        is_mentor: false,
      });
      const convergedIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 64,
        name: 'Stale Optimistic Name',
        job_title: 'Principal Engineer',
        company: 'Next Corp',
        is_mentor: true,
      });

      primeUserProfileDtoCache(64, 'zh_TW', primedDto);
      // Override entry TTL to 1s so the cache entry expires while the 10s optimistic window remains active
      userProfileDtoReadManager.set('64-zh_TW', primedDto, 1_000);
      vi.advanceTimersByTime(1_001);

      expect(userProfileDtoReadManager.get('64-zh_TW')).toBeUndefined();
      expect(userProfileDtoReadManager.getSnapshot('64-zh_TW')).toEqual({
        value: primedDto,
        isStale: true,
      });
      expect(isOptimisticTransitionActive()).toBe(true);

      const nonConvergedResult = await resolveUserProfileDtoFetch(
        '64-zh_TW',
        async () => staleIncomingDto,
        new AbortController().signal
      );
      expect(nonConvergedResult).toBe(primedDto);

      const convergedResult = await resolveUserProfileDtoFetch(
        '64-zh_TW',
        async () => convergedIncomingDto,
        new AbortController().signal
      );
      expect(convergedResult).toBe(convergedIncomingDto);

      clearUserProfileDtoCache(64, 'zh_TW');
    });

    it('retains existing cached DTO when background revalidation resolves null', async () => {
      const existingDto = fromPartial<MentorProfileVO>({
        user_id: 61,
        name: 'Existing Mentor',
      });
      primeUserProfileDtoCache(61, 'zh_TW', existingDto);
      vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

      const result = await resolveUserProfileDtoFetch(
        '61-zh_TW',
        async () => null,
        new AbortController().signal
      );
      expect(result).toBe(existingDto);

      const uncachedNull = await resolveUserProfileDtoFetch(
        '999-zh_TW',
        async () => null,
        new AbortController().signal
      );
      expect(uncachedNull).toBeNull();

      clearUserProfileDtoCache(61, 'zh_TW');
    });

    it('evicts cached entry when manual force: true refetch resolves null or throws', async () => {
      const dto1 = fromPartial<MentorProfileVO>({
        user_id: 62,
        name: 'Deleted Mentor',
      });
      primeUserProfileDtoCache(62, 'zh_TW', dto1);

      const nullResult = await resolveUserProfileDtoFetch(
        '62-zh_TW',
        async () => null,
        new AbortController().signal,
        { force: true }
      );
      expect(nullResult).toBeNull();
      expect(userProfileDtoReadManager.peek('62-zh_TW')).toBeUndefined();
      expect(getUserProfileDtoFromCache(62, 'zh_TW')).toBeNull();

      const dto2 = fromPartial<MentorProfileVO>({
        user_id: 63,
        name: 'Error Mentor',
      });
      primeUserProfileDtoCache(63, 'zh_TW', dto2);

      await expect(
        resolveUserProfileDtoFetch(
          '63-zh_TW',
          async () => {
            throw new Error('Network failure');
          },
          new AbortController().signal,
          { force: true }
        )
      ).rejects.toThrow('Network failure');
      expect(userProfileDtoReadManager.peek('63-zh_TW')).toBeUndefined();
      expect(getUserProfileDtoFromCache(63, 'zh_TW')).toBeNull();

      clearUserProfileDtoCache(62, 'zh_TW');
      clearUserProfileDtoCache(63, 'zh_TW');
    });
  });

  describe('hasProfileDtoConverged & hasDtoConverged alias', () => {
    it('shares canonical reference with hasProfileDtoConverged and validates ?v= upload version equality across &cb= cache-busters and industry edits', () => {
      expect(hasDtoConverged).toBe(hasProfileDtoConverged);

      const primed = fromPartial<MentorProfileVO>({
        user_id: 70,
        name: 'Mentor',
        avatar: 'https://s3.amazonaws.com/bucket/files/70/avatar?v=1754',
        industry: { subject_group: 'FINANCE', subject: '金融業' },
        is_mentor: true,
        onboarding: true,
      });

      const staleAvatarVersion = fromPartial<MentorProfileVO>({
        ...primed,
        avatar: 'https://s3.amazonaws.com/bucket/files/70/avatar?v=1753&cb=now',
      });
      expect(hasProfileDtoConverged(primed, staleAvatarVersion)).toBe(false);

      const prefixTrapAvatar = fromPartial<MentorProfileVO>({
        ...primed,
        avatar: 'https://s3.amazonaws.com/bucket/files/70/avatar?v=175499',
      });
      expect(hasProfileDtoConverged(primed, prefixTrapAvatar)).toBe(false);

      const staleIndustry = fromPartial<MentorProfileVO>({
        ...primed,
        industry: { subject_group: 'TECH', subject: '科技業' },
      });
      expect(hasProfileDtoConverged(primed, staleIndustry)).toBe(false);

      const converged = fromPartial<MentorProfileVO>({
        ...primed,
        avatar:
          'https://s3.amazonaws.com/bucket/files/70/avatar?v=1754&cb=2026-11-14T00%3A00%3A00Z',
        industry: {
          id: 9,
          kind: 'industry',
          subject_group: 'FINANCE',
          subject: '金融業',
        },
      });
      expect(hasProfileDtoConverged(primed, converged)).toBe(true);
    });
  });
});

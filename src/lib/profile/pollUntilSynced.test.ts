import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/user', () => ({
  fetchUser: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { defaultValues } from '@/schemas/profileSchema';
import { fetchUser, type MentorProfileVO } from '@/services/profile/user';

import { firstSyncedFetch } from './pollUntilSynced';

const mockFetchUser = vi.mocked(fetchUser);

const baseValues = {
  ...defaultValues,
  name: 'Sync Test',
  location: 'Taiwan',
  about: 'about-me',
  statement: 'statement',
  years_of_experience: '1_3',
  industry: 'tech',
};

const makeSyncedDto = (avatar = ''): MentorProfileVO =>
  ({
    user_id: 1,
    name: 'Sync Test',
    avatar,
    location: 'Taiwan',
    about: 'about-me',
    personal_statement: 'statement',
    years_of_experience: '1_3',
    industry: { subject_group: 'tech' },
    is_mentor: true,
    onboarding: true,
    experiences: [],
  }) as unknown as MentorProfileVO;

describe('firstSyncedFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchUser.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the dto when backend already reflects submitted values', async () => {
    mockFetchUser.mockResolvedValueOnce(makeSyncedDto());

    const result = await firstSyncedFetch(baseValues, '');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Sync Test');
  });

  it('returns null when backend has not yet synced (values disagree)', async () => {
    mockFetchUser.mockResolvedValueOnce({
      ...makeSyncedDto(),
      name: 'Old Name',
    } as MentorProfileVO);

    const result = await firstSyncedFetch(baseValues, '');

    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetchUser.mockRejectedValueOnce(new Error('network down'));

    const result = await firstSyncedFetch(baseValues, '');

    expect(result).toBeNull();
  });

  it('returns null when fetch exceeds timeout (does not block forever)', async () => {
    mockFetchUser.mockImplementationOnce(
      () =>
        new Promise<MentorProfileVO | null>(() => {
          // Never resolves — must be cut by the timeout.
        })
    );

    const promise = firstSyncedFetch(baseValues, '', 100);
    await vi.advanceTimersByTimeAsync(150);

    expect(await promise).toBeNull();
  });

  describe('isProfileSynced industry boundary conditions', () => {
    it('syncs successfully when latest.industry matching values.industry', async () => {
      mockFetchUser.mockResolvedValueOnce({
        ...makeSyncedDto(),
        industry: { subject_group: 'tech' },
      } as unknown as MentorProfileVO);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry does not match values.industry', async () => {
      mockFetchUser.mockResolvedValueOnce({
        ...makeSyncedDto(),
        industry: { subject_group: 'design' },
      } as unknown as MentorProfileVO);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('syncs successfully when latest.industry is null and values.industry is undefined or empty', async () => {
      mockFetchUser.mockResolvedValueOnce({
        ...makeSyncedDto(),
        industry: null,
      } as MentorProfileVO);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: '' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry is null but values.industry has a value', async () => {
      mockFetchUser.mockResolvedValueOnce({
        ...makeSyncedDto(),
        industry: null,
      } as MentorProfileVO);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('syncs successfully when latest.industry is undefined and values.industry is empty', async () => {
      const dto = makeSyncedDto();
      delete dto.industry;
      mockFetchUser.mockResolvedValueOnce(dto);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: '' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry is undefined but values.industry has a value', async () => {
      const dto = makeSyncedDto();
      delete dto.industry;
      mockFetchUser.mockResolvedValueOnce(dto);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('does not sync when latest.industry is a primitive invalid value', async () => {
      mockFetchUser.mockResolvedValueOnce({
        ...makeSyncedDto(),
        industry: 'not-an-object' as unknown,
      } as unknown as MentorProfileVO);

      const result = await firstSyncedFetch(
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });
  });
});

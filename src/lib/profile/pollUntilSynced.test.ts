import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { fromAny, fromPartial } from '@total-typescript/shoehorn';

import { defaultValues } from '@/schemas/profileSchema';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

import { firstSyncedFetch } from './pollUntilSynced';

const mockFetchUserById = vi.mocked(fetchUserById);

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
  fromAny({
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
  });

describe('firstSyncedFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchUserById.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the dto when backend already reflects submitted values', async () => {
    mockFetchUserById.mockResolvedValueOnce(makeSyncedDto());

    const result = await firstSyncedFetch(1, baseValues, '');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Sync Test');
  });

  it('returns null when backend has not yet synced (values disagree)', async () => {
    mockFetchUserById.mockResolvedValueOnce(
      fromPartial({
        ...makeSyncedDto(),
        name: 'Old Name',
      })
    );

    const result = await firstSyncedFetch(1, baseValues, '');

    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetchUserById.mockRejectedValueOnce(new Error('network down'));

    const result = await firstSyncedFetch(1, baseValues, '');

    expect(result).toBeNull();
  });

  it('returns null when fetch exceeds timeout (does not block forever)', async () => {
    mockFetchUserById.mockImplementationOnce(
      () =>
        new Promise<MentorProfileVO | null>(() => {
          // Never resolves — must be cut by the timeout.
        })
    );

    const promise = firstSyncedFetch(1, baseValues, '', 100);
    await vi.advanceTimersByTimeAsync(150);

    expect(await promise).toBeNull();
  });

  describe('isProfileSynced industry boundary conditions', () => {
    it('syncs successfully when latest.industry matching values.industry', async () => {
      mockFetchUserById.mockResolvedValueOnce(
        fromAny({
          ...makeSyncedDto(),
          industry: { subject_group: 'tech' },
        })
      );

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry does not match values.industry', async () => {
      mockFetchUserById.mockResolvedValueOnce(
        fromAny({
          ...makeSyncedDto(),
          industry: { subject_group: 'design' },
        })
      );

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('syncs successfully when latest.industry is null and values.industry is undefined or empty', async () => {
      mockFetchUserById.mockResolvedValueOnce(
        fromPartial({
          ...makeSyncedDto(),
          industry: null,
        })
      );

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: '' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry is null but values.industry has a value', async () => {
      mockFetchUserById.mockResolvedValueOnce(
        fromPartial({
          ...makeSyncedDto(),
          industry: null,
        })
      );

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('syncs successfully when latest.industry is undefined and values.industry is empty', async () => {
      const dto = makeSyncedDto();
      delete dto.industry;
      mockFetchUserById.mockResolvedValueOnce(dto);

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: '' },
        ''
      );
      expect(result).not.toBeNull();
    });

    it('does not sync when latest.industry is undefined but values.industry has a value', async () => {
      const dto = makeSyncedDto();
      delete dto.industry;
      mockFetchUserById.mockResolvedValueOnce(dto);

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });

    it('does not sync when latest.industry is a primitive invalid value', async () => {
      mockFetchUserById.mockResolvedValueOnce(
        fromAny({
          ...makeSyncedDto(),
          industry: 'not-an-object',
        })
      );

      const result = await firstSyncedFetch(
        1,
        { ...baseValues, industry: 'tech' },
        ''
      );
      expect(result).toBeNull();
    });
  });
});

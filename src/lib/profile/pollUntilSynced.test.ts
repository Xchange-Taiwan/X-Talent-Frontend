import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/profile/user', () => ({
  fetchUserById: vi.fn(),
}));

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { fromAny, fromPartial } from '@total-typescript/shoehorn';

import { captureFlowFailure } from '@/lib/monitoring';
import { defaultValues } from '@/schemas/profileSchema';
import { fetchUserById } from '@/services/profile/user';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';
import type { MentorProfileVO } from '@/types/user';

import {
  confirmDeletionSynced,
  confirmProfileSynced,
  firstSyncedFetch,
  type MentorCardFields,
  pollUntilMentorPoolSynced,
  pollUntilUserDeleted,
} from './pollUntilSynced';

const mockFetchUserById = vi.mocked(fetchUserById);
const mockFetchMentors = vi.mocked(fetchMentors);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const makeMentor = (
  user_id: number,
  overrides: Partial<MentorType> = {}
): MentorType =>
  fromPartial({
    user_id,
    name: `Mentor ${user_id}`,
    job_title: '',
    company: '',
    about: '',
    years_of_experience: '',
    have_topic: [],
    avatar: '',
    ...overrides,
  });

const makeFields = (
  overrides: Partial<MentorCardFields> = {}
): MentorCardFields => ({
  name: 'New Name',
  jobTitle: '',
  company: '',
  about: '',
  yearsOfExperience: '',
  haveTopic: [],
  avatar: '',
  ...overrides,
});

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

describe('pollUntilUserDeleted', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchMentors.mockReset();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true immediately for a falsy/NaN userId without fetching', async () => {
    const result = await pollUntilUserDeleted(NaN);

    expect(result).toBe(true);
    expect(mockFetchMentors).not.toHaveBeenCalled();
  });

  it('returns true as soon as the user is absent from the mentor-pool listing (no name → unfiltered search)', async () => {
    mockFetchMentors.mockResolvedValueOnce([makeMentor(2), makeMentor(3)]);

    const result = await pollUntilUserDeleted(1, undefined, 6, 2000);

    expect(result).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: '',
      limit: 20,
      cursor: '',
    });
  });

  it('scopes the query to search_pattern when a name is given', async () => {
    mockFetchMentors.mockResolvedValueOnce([]);

    await pollUntilUserDeleted(1, 'Jane Doe', 6, 2000);

    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane Doe',
      limit: 20,
      cursor: '',
    });
  });

  it('keeps retrying while the user is still in the listing, then succeeds', async () => {
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(1), makeMentor(2)])
      .mockResolvedValueOnce([makeMentor(1)])
      .mockResolvedValueOnce([makeMentor(2)]);

    const promise = pollUntilUserDeleted(1, undefined, 6, 2000);
    await vi.advanceTimersByTimeAsync(2000 * 2);

    expect(await promise).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
  });

  it('treats fetch errors as inconclusive and keeps retrying', async () => {
    mockFetchMentors
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([makeMentor(2)]);

    const promise = pollUntilUserDeleted(1, undefined, 6, 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('returns false and reports a flow failure once the retry budget is exhausted', async () => {
    mockFetchMentors.mockResolvedValue([makeMentor(1)]);

    const promise = pollUntilUserDeleted(1, undefined, 3, 2000);
    await vi.advanceTimersByTimeAsync(2000 * 3);

    expect(await promise).toBe(false);
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'poll_deletion_sync',
      })
    );
  });
});

describe('pollUntilMentorPoolSynced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchMentors.mockReset();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true immediately for a falsy/NaN userId without fetching', async () => {
    const result = await pollUntilMentorPoolSynced(NaN, makeFields());

    expect(result).toBe(true);
    expect(mockFetchMentors).not.toHaveBeenCalled();
  });

  it('returns true once the card reflects every card-visible field', async () => {
    const fields = makeFields({
      name: 'New Name',
      jobTitle: 'Engineer',
      company: 'Acme',
      about: 'new about',
      yearsOfExperience: '5_10',
      haveTopic: ['career', 'leadership'],
      avatar: 'https://cdn/a.png',
    });
    mockFetchMentors.mockResolvedValueOnce([
      makeMentor(1, {
        name: 'New Name',
        job_title: 'Engineer',
        company: 'Acme',
        about: 'new about',
        years_of_experience: '5_10',
        have_topic: ['leadership', 'career'], // order-independent
        avatar: 'https://cdn/a.png?cb=123',
      }),
    ]);

    const result = await pollUntilMentorPoolSynced(1, fields, 6, 2000);

    expect(result).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
    // Scoped by search_pattern (not an unfiltered listing) so a mentor
    // buried past the unfiltered page size is still found.
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'New Name',
      limit: 20,
      cursor: '',
    });
  });

  it('keeps retrying when name and avatar already match but another card-visible field (job_title) is still stale', async () => {
    const fields = makeFields({
      name: 'Same Name',
      jobTitle: 'Senior Engineer',
      avatar: 'https://cdn/a.png',
    });
    mockFetchMentors
      .mockResolvedValueOnce([
        makeMentor(1, {
          name: 'Same Name',
          job_title: 'Engineer', // stale — only this field lags
          avatar: 'https://cdn/a.png?cb=123',
        }),
      ])
      .mockResolvedValueOnce([
        makeMentor(1, {
          name: 'Same Name',
          job_title: 'Senior Engineer',
          avatar: 'https://cdn/a.png?cb=124',
        }),
      ]);

    const promise = pollUntilMentorPoolSynced(1, fields, 6, 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying while the card still shows the old name, then succeeds', async () => {
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(1, { name: 'Old Name' })])
      .mockResolvedValueOnce([makeMentor(1, { name: 'New Name' })]);

    const promise = pollUntilMentorPoolSynced(
      1,
      makeFields({ name: 'New Name' }),
      6,
      2000
    );
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(true);
    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying while the card is missing entirely (newly-mentor case), then succeeds', async () => {
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(2)])
      .mockResolvedValueOnce([
        makeMentor(1, { name: 'New Mentor' }),
        makeMentor(2),
      ]);

    const promise = pollUntilMentorPoolSynced(
      1,
      makeFields({ name: 'New Mentor' }),
      6,
      2000
    );
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(true);
  });

  it('returns false and reports a flow failure once the retry budget is exhausted', async () => {
    mockFetchMentors.mockResolvedValue([makeMentor(1, { name: 'Old Name' })]);

    const promise = pollUntilMentorPoolSynced(
      1,
      makeFields({ name: 'New Name' }),
      3,
      2000
    );
    await vi.advanceTimersByTimeAsync(2000 * 3);

    expect(await promise).toBe(false);
    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'poll_mentor_pool_sync',
      })
    );
  });
});

describe('confirmProfileSynced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchMentors.mockReset();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('not mentor-relevant → skips the poll entirely and never invokes revalidate', async () => {
    const revalidate = vi.fn().mockResolvedValue(undefined);

    await confirmProfileSynced(1, makeFields(), false, revalidate);

    expect(mockFetchMentors).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('mentor-relevant → polls the mentor-pool listing until synced, then revalidates', async () => {
    const fields = makeFields({ name: 'New Name' });
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(1, { name: 'Old Name' })])
      .mockResolvedValueOnce([makeMentor(1, { name: 'New Name' })]);
    const revalidate = vi.fn().mockResolvedValue(undefined);

    const promise = confirmProfileSynced(1, fields, true, revalidate);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('mentor-relevant, poll exhausts retry budget → still revalidates', async () => {
    mockFetchMentors.mockResolvedValue([makeMentor(1, { name: 'Old Name' })]);
    const revalidate = vi.fn().mockResolvedValue(undefined);

    const promise = confirmProfileSynced(
      1,
      makeFields({ name: 'New Name' }),
      true,
      revalidate
    );
    // pollUntilMentorPoolSynced's own default retry budget (12 * 5000ms).
    await vi.advanceTimersByTimeAsync(5000 * 12);
    await promise;

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('mentor-relevant, poll rejecting (contract violation) is reported but revalidate still runs unconditionally', async () => {
    const poll = vi.fn().mockRejectedValue(new Error('poll blew up'));
    const revalidate = vi.fn().mockResolvedValue(undefined);

    await confirmProfileSynced(1, makeFields(), true, revalidate, poll);

    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'poll_mentor_pool_sync_error',
        message: 'poll blew up',
        level: 'warning',
      })
    );
  });
});

describe('confirmDeletionSynced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchMentors.mockReset();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls (via the real pollUntilUserDeleted by default) until the user is absent, then invokes every revalidatePaths callback', async () => {
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(42)])
      .mockResolvedValueOnce([]);
    const revalidateProfile = vi.fn();
    const revalidateMentorPool = vi.fn();

    const promise = confirmDeletionSynced(42, 'Jane Doe', [
      revalidateProfile,
      revalidateMentorPool,
    ]);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
    expect(revalidateProfile).toHaveBeenCalledTimes(1);
    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
  });

  it('poll rejecting (contract violation) is reported but every revalidatePaths callback still runs unconditionally', async () => {
    const poll = vi.fn().mockRejectedValue(new Error('poll blew up'));
    const revalidateProfile = vi.fn();
    const revalidateMentorPool = vi.fn();

    await confirmDeletionSynced(
      42,
      'Jane Doe',
      [revalidateProfile, revalidateMentorPool],
      poll
    );

    expect(revalidateProfile).toHaveBeenCalledTimes(1);
    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'after_poll',
        message: 'poll blew up',
        level: 'warning',
      })
    );
  });

  it('poll never confirming (exhausted retry budget) still runs every revalidatePaths callback', async () => {
    const poll = vi.fn().mockResolvedValue(false);
    const revalidateProfile = vi.fn();
    const revalidateMentorPool = vi.fn();

    await confirmDeletionSynced(
      42,
      'Jane Doe',
      [revalidateProfile, revalidateMentorPool],
      poll
    );

    expect(revalidateProfile).toHaveBeenCalledTimes(1);
    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
  });

  it('one revalidatePaths callback throwing is reported but does not prevent the remaining callbacks from running', async () => {
    const poll = vi.fn().mockResolvedValue(true);
    const revalidateProfile = vi.fn(() => {
      throw new Error('revalidate blew up');
    });
    const revalidateMentorPool = vi.fn();

    await confirmDeletionSynced(
      42,
      'Jane Doe',
      [revalidateProfile, revalidateMentorPool],
      poll
    );

    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: 'revalidate blew up',
        level: 'warning',
      })
    );
  });

  it('falls back to an unscoped poll when no name is given (default poll)', async () => {
    mockFetchMentors.mockResolvedValueOnce([]);

    await confirmDeletionSynced(42, undefined, [vi.fn()]);

    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: '',
      limit: 20,
      cursor: '',
    });
  });
});

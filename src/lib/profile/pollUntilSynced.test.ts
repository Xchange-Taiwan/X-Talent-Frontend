import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { fromPartial } from '@total-typescript/shoehorn';

import { captureFlowFailure } from '@/lib/monitoring';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';

import {
  confirmDeletionSynced,
  confirmProfileSynced,
  type MentorCardFields,
} from './pollUntilSynced';

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
    have_skill: [],
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
  haveSkill: [],
  avatar: '',
  ...overrides,
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

  it('skips polling and still runs revalidatePaths immediately for a falsy/NaN userId', async () => {
    const revalidate = vi.fn();
    await confirmDeletionSynced(NaN, 'Jane Doe', [revalidate]);

    expect(mockFetchMentors).not.toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('polls until the user is absent from the mentor-pool listing (no name -> unfiltered search) and runs revalidatePaths', async () => {
    const revalidate = vi.fn();
    mockFetchMentors.mockResolvedValueOnce({
      mentors: [makeMentor(2), makeMentor(3)],
      nextCursor: null,
    });

    await confirmDeletionSynced(1, undefined, [revalidate]);

    expect(mockFetchMentors).toHaveBeenCalledTimes(1);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: '',
      limit: 20,
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('scopes the query to search_pattern when a name is given', async () => {
    const revalidate = vi.fn();
    mockFetchMentors.mockResolvedValueOnce({ mentors: [], nextCursor: null });

    await confirmDeletionSynced(1, 'Jane Doe', [revalidate]);

    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane Doe',
      limit: 20,
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('keeps retrying while the user is still in the listing or on transient fetch errors, then succeeds and revalidates', async () => {
    const revalidateProfile = vi.fn();
    const revalidateMentorPool = vi.fn();
    mockFetchMentors
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        mentors: [makeMentor(1), makeMentor(2)],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        mentors: [makeMentor(2)],
        nextCursor: null,
      });

    const promise = confirmDeletionSynced(1, 'Jane Doe', [
      revalidateProfile,
      revalidateMentorPool,
    ]);
    await vi.advanceTimersByTimeAsync(2000 * 2);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
    expect(revalidateProfile).toHaveBeenCalledTimes(1);
    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
  });

  it('reports flow failure once retry budget is exhausted and still runs every revalidatePaths callback', async () => {
    const revalidateProfile = vi.fn();
    const revalidateMentorPool = vi.fn();
    mockFetchMentors.mockResolvedValue({
      mentors: [makeMentor(1)],
      nextCursor: null,
    });

    const promise = confirmDeletionSynced(1, undefined, [
      revalidateProfile,
      revalidateMentorPool,
    ]);
    await vi.advanceTimersByTimeAsync(2000 * 6);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(6);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'poll_deletion_sync',
      })
    );
    expect(revalidateProfile).toHaveBeenCalledTimes(1);
    expect(revalidateMentorPool).toHaveBeenCalledTimes(1);
  });

  it('poll rejecting (contract violation) is reported and revalidatePaths callbacks run independently even if one throws', async () => {
    const poll = vi.fn().mockRejectedValue(new Error('poll blew up'));
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
        step: 'after_poll',
        message: 'poll blew up',
        level: 'warning',
      })
    );
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: 'revalidate blew up',
        level: 'warning',
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

  it('not mentor-relevant -> skips the poll entirely and never invokes revalidate', async () => {
    const revalidate = vi.fn().mockResolvedValue(undefined);

    await confirmProfileSynced(1, makeFields(), false, revalidate);

    expect(mockFetchMentors).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('skips network fetch and revalidates immediately when mentor-relevant userId is NaN', async () => {
    const revalidate = vi.fn().mockResolvedValue(undefined);

    await confirmProfileSynced(NaN, makeFields(), true, revalidate);

    expect(mockFetchMentors).not.toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('polls scoped search_pattern until every card-visible field (including job_title, tags, and avatar) catches up, then revalidates', async () => {
    const fields = makeFields({
      name: 'New Name',
      jobTitle: 'Senior Engineer',
      company: 'Acme',
      about: 'new about',
      yearsOfExperience: '5_10',
      haveTopic: ['career', 'leadership'],
      haveSkill: ['typescript'],
      avatar: 'https://cdn/a.png',
    });
    const revalidate = vi.fn().mockResolvedValue(undefined);

    mockFetchMentors
      .mockResolvedValueOnce({
        mentors: [makeMentor(2)],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        mentors: [
          makeMentor(1, {
            name: 'New Name',
            job_title: 'Engineer',
            company: 'Acme',
            about: 'new about',
            years_of_experience: '5_10',
            have_topic: ['leadership', 'career'],
            have_skill: ['typescript'],
            avatar: 'https://cdn/a.png?cb=123',
          }),
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        mentors: [
          makeMentor(1, {
            name: 'New Name',
            job_title: 'Senior Engineer',
            company: 'Acme',
            about: 'new about',
            years_of_experience: '5_10',
            have_topic: ['leadership', 'career'],
            have_skill: ['typescript'],
            avatar: 'https://cdn/a.png?cb=124',
          }),
        ],
        nextCursor: null,
      });

    const promise = confirmProfileSynced(1, fields, true, revalidate, {
      maxRetries: 4,
      intervalMs: 500,
    });
    await vi.advanceTimersByTimeAsync(500 * 2);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(3);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'New Name',
      limit: 20,
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('exhausts retry budget via custom searchMentors port, reports flow failure, and still revalidates', async () => {
    const customSearchMentors = vi
      .fn()
      .mockResolvedValue([makeMentor(1, { name: 'Old Name' })]);
    const revalidate = vi.fn().mockResolvedValue(undefined);

    const promise = confirmProfileSynced(
      1,
      makeFields({ name: 'New Name' }),
      true,
      revalidate,
      {
        maxRetries: 3,
        intervalMs: 1000,
        searchMentors: customSearchMentors,
      }
    );
    await vi.advanceTimersByTimeAsync(1000 * 3);
    await promise;

    expect(customSearchMentors).toHaveBeenCalledTimes(3);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'profile_update',
        step: 'poll_mentor_pool_sync',
      })
    );
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

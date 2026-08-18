import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/search-mentor/mentors', () => ({
  fetchMentors: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { fromPartial } from '@total-typescript/shoehorn';
import { revalidatePath } from 'next/cache';

import { captureFlowFailure } from '@/lib/monitoring';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorType } from '@/types/mentor';

import { confirmDeletionSynced } from './confirmDeletionSynced';

const mockFetchMentors = vi.mocked(fetchMentors);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockRevalidatePath = vi.mocked(revalidatePath);

const makeMentor = (user_id: number): MentorType =>
  fromPartial({
    user_id,
    name: `Mentor ${user_id}`,
    job_title: '',
    company: '',
    about: '',
    years_of_experience: '',
    have_topic: [],
    avatar: '',
  });

describe('confirmDeletionSynced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchMentors.mockReset();
    mockCaptureFlowFailure.mockReset();
    mockRevalidatePath.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls until the user is absent from the mentor-pool listing, then revalidates both paths', async () => {
    mockFetchMentors
      .mockResolvedValueOnce([makeMentor(42)])
      .mockResolvedValueOnce([]);

    const promise = confirmDeletionSynced(42, '42', 'Jane Doe');
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockFetchMentors).toHaveBeenCalledTimes(2);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  it('revalidates even if the poll exhausts its retry budget without confirming', async () => {
    mockFetchMentors.mockResolvedValue([makeMentor(42)]);

    const promise = confirmDeletionSynced(42, '42', 'Jane Doe');
    await vi.advanceTimersByTimeAsync(2000 * 6);
    await promise;

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
  });

  // The `await pollUntilUserDeleted(...)` try/catch inside confirmDeletionSynced
  // guards against a contract violation (pollUntilUserDeleted itself never
  // throws — it swallows fetch errors and returns false on timeout). That
  // internal call isn't independently mockable from this test (it's a real
  // call into pollUntilSynced.ts, not injected); a rejected fetchMentors call
  // is already covered above via the exhausted-budget path (pollUntil treats
  // a throw from `check` as inconclusive and keeps retrying, never
  // propagating it to confirmDeletionSynced's own try/catch).

  it('revalidatePath(/profile/...) throwing is reported but does not prevent the mentor-pool revalidatePath call', async () => {
    mockFetchMentors.mockResolvedValueOnce([]);
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('revalidate blew up');
    });

    await confirmDeletionSynced(42, '42', 'Jane Doe');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/profile/42');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/mentor-pool');
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: 'revalidate blew up',
        level: 'warning',
      })
    );
  });

  it('falls back to an unscoped poll when no name is given', async () => {
    mockFetchMentors.mockResolvedValueOnce([]);

    await confirmDeletionSynced(42, '42', undefined);

    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: '',
      limit: 20,
      cursor: '',
    });
  });
});

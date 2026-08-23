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
  ProfileRecordAdapter,
  runConvergence,
  SearchIndexDeleteAdapter,
  SearchIndexSyncAdapter,
} from './convergence';

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

const baseValues = {
  ...defaultValues,
  name: 'Sync Test',
  location: 'Taiwan',
  about: 'about-me',
  statement: 'statement',
  years_of_experience: '1_3',
  industry: 'tech',
};

describe('runConvergence with Mock Adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCaptureFlowFailure.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately on the first attempt if the adapter is caught up', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('data'),
      isCaughtUp: vi.fn().mockReturnValue(true),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'mock exhaust message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(true);
    expect(latest).toBe('data');
    expect(adapter.fetch).toHaveBeenCalledTimes(1);
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('retries and eventually succeeds when adapter is caught up on subsequent attempts', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('data'),
      isCaughtUp: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'mock exhaust message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(true);
    expect(latest).toBe('data');
    expect(adapter.fetch).toHaveBeenCalledTimes(2);
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('fails and reports exhaustion once retry budget is fully exhausted', async () => {
    const adapter = {
      fetch: vi.fn().mockResolvedValue('stale_data'),
      isCaughtUp: vi.fn().mockReturnValue(false),
      getExhaustionMetadata: vi.fn().mockReturnValue({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'exhausted budget message',
      }),
    };

    const promise = runConvergence(adapter, 3, 1000);
    await vi.advanceTimersByTimeAsync(1000 * 3);
    const { confirmed, latest } = await promise;

    expect(confirmed).toBe(false);
    expect(latest).toBe('stale_data');
    expect(adapter.fetch).toHaveBeenCalledTimes(3);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'mock_flow',
        step: 'mock_step',
        message: 'exhausted budget message',
      })
    );
  });
});

describe('ProfileRecordAdapter', () => {
  beforeEach(() => {
    mockFetchUserById.mockReset();
  });

  it('fetches latest profile by userId', async () => {
    const dto = makeSyncedDto();
    mockFetchUserById.mockResolvedValueOnce(dto);

    const adapter = new ProfileRecordAdapter(1, baseValues, '');
    const result = await adapter.fetch();

    expect(result).toBe(dto);
    expect(mockFetchUserById).toHaveBeenCalledWith(1, 'zh_TW', undefined, true);
  });

  it('returns null on fetch user error', async () => {
    mockFetchUserById.mockRejectedValueOnce(new Error('network error'));

    const adapter = new ProfileRecordAdapter(1, baseValues, '');
    const result = await adapter.fetch();

    expect(result).toBeNull();
  });

  it('checks caught up based on profile sync logic', () => {
    const adapter = new ProfileRecordAdapter(1, baseValues, '');
    const dto = makeSyncedDto();

    expect(adapter.isCaughtUp(dto)).toBe(true);

    const staleDto = fromPartial<MentorProfileVO>({
      ...dto,
      name: 'Stale Name',
    });
    expect(adapter.isCaughtUp(staleDto)).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const adapter = new ProfileRecordAdapter(1, baseValues, '');
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
    });
  });
});

describe('SearchIndexSyncAdapter', () => {
  beforeEach(() => {
    mockFetchMentors.mockReset();
  });

  it('fetches mentors from index scoped to name', async () => {
    const fields = {
      name: 'Jane Doe',
      jobTitle: 'Developer',
      company: 'Acme',
      about: 'about-me',
      yearsOfExperience: '5_10',
      haveTopic: ['tech'],
      avatar: 'avatar-url',
    };
    mockFetchMentors.mockResolvedValueOnce([]);

    const adapter = new SearchIndexSyncAdapter(1, fields);
    const result = await adapter.fetch();

    expect(result).toEqual([]);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane Doe',
      limit: 20,
      cursor: '',
    });
  });

  it('returns null on fetch mentors error', async () => {
    const fields = {
      name: 'Jane Doe',
      jobTitle: 'Developer',
      company: 'Acme',
      about: 'about-me',
      yearsOfExperience: '5_10',
      haveTopic: ['tech'],
      avatar: 'avatar-url',
    };
    mockFetchMentors.mockRejectedValueOnce(new Error('search down'));

    const adapter = new SearchIndexSyncAdapter(1, fields);
    const result = await adapter.fetch();

    expect(result).toBeNull();
  });

  it('is caught up when mentor with userId matches all fields', () => {
    const fields = {
      name: 'Jane Doe',
      jobTitle: 'Developer',
      company: 'Acme',
      about: 'about-me',
      yearsOfExperience: '5_10',
      haveTopic: ['tech', 'career'],
      avatar: 'https://cdn/avatar.png',
    };
    const adapter = new SearchIndexSyncAdapter(1, fields);

    const matchedMentor = makeMentor(1, {
      name: 'Jane Doe',
      job_title: 'Developer',
      company: 'Acme',
      about: 'about-me',
      years_of_experience: '5_10',
      have_topic: ['career', 'tech'],
      avatar: 'https://cdn/avatar.png?cb=123',
    });

    expect(adapter.isCaughtUp([matchedMentor])).toBe(true);

    const staleMentor = makeMentor(1, {
      name: 'Jane Doe',
      job_title: 'Stale Title',
      company: 'Acme',
      about: 'about-me',
      years_of_experience: '5_10',
      have_topic: ['career', 'tech'],
      avatar: 'https://cdn/avatar.png?cb=123',
    });

    expect(adapter.isCaughtUp([staleMentor])).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const fields = {
      name: 'Jane Doe',
      jobTitle: 'Developer',
      company: 'Acme',
      about: 'about-me',
      yearsOfExperience: '5_10',
      haveTopic: ['tech'],
      avatar: 'avatar-url',
    };
    const adapter = new SearchIndexSyncAdapter(1, fields);
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'profile_update',
      step: 'poll_mentor_pool_sync',
      message:
        'pollUntilMentorPoolSynced exhausted retries without confirmation',
    });
  });
});

describe('SearchIndexDeleteAdapter', () => {
  beforeEach(() => {
    mockFetchMentors.mockReset();
  });

  it('fetches mentors from index scoped to optional name', async () => {
    mockFetchMentors.mockResolvedValueOnce([]);

    const adapter = new SearchIndexDeleteAdapter(1, 'Jane');
    const result = await adapter.fetch();

    expect(result).toEqual([]);
    expect(mockFetchMentors).toHaveBeenCalledWith({
      search_pattern: 'Jane',
      limit: 20,
      cursor: '',
    });
  });

  it('is caught up when target userId is absent from list', () => {
    const adapter = new SearchIndexDeleteAdapter(42, 'Jane');

    expect(adapter.isCaughtUp([makeMentor(1), makeMentor(2)])).toBe(true);
    expect(adapter.isCaughtUp([makeMentor(42)])).toBe(false);
  });

  it('defines correct exhaustion metadata', () => {
    const adapter = new SearchIndexDeleteAdapter(42, 'Jane');
    expect(adapter.getExhaustionMetadata()).toEqual({
      flow: 'delete_account',
      step: 'poll_deletion_sync',
      message: 'pollUntilUserDeleted exhausted retries without confirmation',
    });
  });
});

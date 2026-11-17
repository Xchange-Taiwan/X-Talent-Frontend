import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { RawMentor } from '@/services/search-mentor/mapMentor';

import {
  addFavoriteMentor,
  fetchFavoriteMentors,
  removeFavoriteMentor,
} from './favoriteMentors';

vi.mock('@/lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/apiClient')>('@/lib/apiClient');
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function buildRawMentor(overrides: Partial<RawMentor> = {}): RawMentor {
  return fromPartial<RawMentor>({
    user_id: 101,
    name: '陳宥廷 Austin',
    avatar: 'https://example.com/avatar.png',
    job_title: 'Senior Product Manager',
    company: 'Google',
    years_of_experience: 'FIVE_TO_TEN_YEARS',
    have_skill: ['產品策略'],
    have_topic: ['職涯規劃'],
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  });
}

describe('favoriteMentors service (#924)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps direct RawMentor[] response (including stats.total_rating_count and null stats) from GET /v1/users/:userId/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce([
      buildRawMentor({
        user_id: 101,
        name: 'Mentor A',
        stats: {
          completed_meeting_count: 12,
          total_rating_count: 3,
          rating_average: 9.0,
        },
      }),
      buildRawMentor({
        user_id: 102,
        name: 'Mentor B',
        stats: null,
      }),
    ]);

    const controller = new AbortController();
    const result = await fetchFavoriteMentors('9001', controller.signal);

    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/users/9001/favorite-mentors',
      expect.objectContaining({ auth: true, signal: controller.signal })
    );
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.user_id)).toEqual([101, 102]);
    expect(result[0]?.name).toBe('Mentor A');
    expect(result[0]?.stats).toEqual({
      completed_meeting_count: 12,
      rating_count: 3,
      rating_average: 9.0,
    });
    expect(result[1]?.stats).toBeNull();
  });

  it('maps { mentors: RawMentor[] } object response from GET /v1/users/:userId/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce({
      mentors: [buildRawMentor({ user_id: 205, name: 'Zahra Lin' })],
    });

    const result = await fetchFavoriteMentors(9001);

    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/users/9001/favorite-mentors',
      expect.objectContaining({ auth: true })
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.user_id).toBe(205);
    expect(result[0]?.name).toBe('Zahra Lin');
  });

  it('silently degrades to [] when GET /v1/users/:userId/favorite-mentors returns 404 ApiError before backend deployment', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(404, 'Not Found')
    );

    const result = await fetchFavoriteMentors('9001');

    expect(result).toEqual([]);
  });

  it('rethrows non-404 errors (such as 40300 user_id mismatch or 500) from GET /v1/users/:userId/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(403, 'user_id not match', '40300', null)
    );

    await expect(fetchFavoriteMentors('9001')).rejects.toThrow(
      'user_id not match'
    );
  });

  it('calls PUT /v1/users/:userId/favorite-mentors/:mentorId with auth: true when adding favorite', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      code: '0',
      msg: 'ok',
      data: null,
    });

    const controller = new AbortController();
    await addFavoriteMentor('9001', 101, controller.signal);

    expect(apiClient.put).toHaveBeenCalledWith(
      '/v1/users/9001/favorite-mentors/101',
      undefined,
      expect.objectContaining({ auth: true, signal: controller.signal })
    );
  });

  it('calls DELETE /v1/users/:userId/favorite-mentors/:mentorId with auth: true when removing favorite', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      code: '0',
      msg: 'ok',
      data: null,
    });

    const controller = new AbortController();
    await removeFavoriteMentor('9001', 101, controller.signal);

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/v1/users/9001/favorite-mentors/101',
      undefined,
      expect.objectContaining({ auth: true, signal: controller.signal })
    );
  });

  it('throws ApiError when mutation envelope returns non-zero business code (e.g. code "1" or "40300")', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      code: '1',
      msg: 'target_not_mentor',
      data: { type: 'target_not_mentor', message: 'Target is not a mentor' },
    });

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      code: '1',
    });

    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      code: '40300',
      msg: 'user_id not match',
      data: null,
    });

    await expect(removeFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      code: '40300',
      message: 'user_id not match',
    });
  });

  it('propagates HTTP non-2xx errors (403 user_id mismatch, 400/404 business data.type, and 422 FastAPI detail) on PUT and DELETE without swallowing 404', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(
      new ApiError(404, 'Mentor not found', '1', {
        type: 'mentor_not_found',
        message: 'Mentor not found',
      })
    );

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: '1',
      data: { type: 'mentor_not_found', message: 'Mentor not found' },
    });

    vi.mocked(apiClient.put).mockRejectedValueOnce(
      new ApiError(400, 'Profile required', '1', {
        type: 'profile_required',
        message: 'Profile required',
      })
    );

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: '1',
      data: { type: 'profile_required', message: 'Profile required' },
    });

    vi.mocked(apiClient.delete).mockRejectedValueOnce(
      new ApiError(403, 'user_id not match', '40300', null)
    );

    await expect(removeFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: '40300',
      message: 'user_id not match',
    });

    vi.mocked(apiClient.put).mockRejectedValueOnce(
      new ApiError(
        422,
        'path.mentor_id: Input should be a valid integer',
        undefined,
        undefined,
        [{ loc: ['path', 'mentor_id'], msg: 'Input should be a valid integer' }]
      )
    );

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'path.mentor_id: Input should be a valid integer',
    });
  });

  it('rejects empty/non-positive/NaN userId and non-positive/non-integer mentorId without issuing network calls', async () => {
    await expect(fetchFavoriteMentors('   ')).rejects.toThrow(/userId/i);
    await expect(fetchFavoriteMentors(Number.NaN)).rejects.toThrow(/userId/i);
    await expect(
      fetchFavoriteMentors(Number.POSITIVE_INFINITY)
    ).rejects.toThrow(/userId/i);
    await expect(fetchFavoriteMentors(0)).rejects.toThrow(/userId/i);
    await expect(fetchFavoriteMentors(-5)).rejects.toThrow(/userId/i);

    await expect(addFavoriteMentor('', 101)).rejects.toThrow(/userId/i);
    await expect(addFavoriteMentor(Number.NaN, 101)).rejects.toThrow(/userId/i);
    await expect(removeFavoriteMentor(' ', 101)).rejects.toThrow(/userId/i);

    await expect(addFavoriteMentor('9001', Number.NaN)).rejects.toThrow(
      /mentorId/i
    );
    await expect(
      addFavoriteMentor('9001', Number.POSITIVE_INFINITY)
    ).rejects.toThrow(/mentorId/i);
    await expect(addFavoriteMentor('9001', 0)).rejects.toThrow(/mentorId/i);
    await expect(addFavoriteMentor('9001', -1)).rejects.toThrow(/mentorId/i);
    await expect(addFavoriteMentor('9001', 1.5)).rejects.toThrow(/mentorId/i);
    await expect(removeFavoriteMentor('9001', 0)).rejects.toThrow(/mentorId/i);
    await expect(removeFavoriteMentor('9001', -10)).rejects.toThrow(
      /mentorId/i
    );

    expect(apiClient.getUnwrapped).not.toHaveBeenCalled();
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });
});

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

describe('favoriteMentors service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps direct RawMentor[] response from GET /v1/me/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce([
      buildRawMentor({ user_id: 101, name: 'Mentor A' }),
      buildRawMentor({ user_id: 102, name: 'Mentor B' }),
    ]);

    const result = await fetchFavoriteMentors();

    expect(apiClient.getUnwrapped).toHaveBeenCalledWith(
      '/v1/me/favorite-mentors',
      expect.objectContaining({ auth: true })
    );
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.user_id)).toEqual([101, 102]);
    expect(result[0]?.name).toBe('Mentor A');
  });

  it('maps { mentors: RawMentor[] } object response from GET /v1/me/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockResolvedValueOnce({
      mentors: [buildRawMentor({ user_id: 205, name: 'Zahra Lin' })],
    });

    const result = await fetchFavoriteMentors();

    expect(result).toHaveLength(1);
    expect(result[0]?.user_id).toBe(205);
    expect(result[0]?.name).toBe('Zahra Lin');
  });

  it('silently degrades to [] when GET /v1/me/favorite-mentors returns 404 ApiError', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(404, 'Not Found')
    );

    const result = await fetchFavoriteMentors();

    expect(result).toEqual([]);
  });

  it('rethrows non-404 errors from GET /v1/me/favorite-mentors', async () => {
    vi.mocked(apiClient.getUnwrapped).mockRejectedValueOnce(
      new ApiError(500, 'Internal Server Error')
    );

    await expect(fetchFavoriteMentors()).rejects.toThrow(
      'Internal Server Error'
    );
  });

  it('calls PUT /v1/mentors/:id/favorite with auth: true when adding favorite', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      code: '0',
      msg: 'ok',
      data: null,
    });

    await addFavoriteMentor(101);

    expect(apiClient.put).toHaveBeenCalledWith(
      '/v1/mentors/101/favorite',
      undefined,
      expect.objectContaining({ auth: true })
    );
  });

  it('calls DELETE /v1/mentors/:id/favorite with auth: true when removing favorite', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

    await removeFavoriteMentor(101);

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/v1/mentors/101/favorite',
      undefined,
      expect.objectContaining({ auth: true })
    );
  });

  it('throws ApiError when mutation envelope returns non-zero business code', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      code: '500',
      msg: 'Database unavailable',
      data: null,
    });

    await expect(addFavoriteMentor(101)).rejects.toThrow(
      'Database unavailable'
    );
  });
});

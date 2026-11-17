import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, setSessionGetter } from '@/lib/apiClient';

import {
  addFavoriteMentor,
  fetchFavoriteMentors,
  removeFavoriteMentor,
} from './favoriteMentors';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('favoriteMentors BFF wire contract integration (#759 / #924)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://bff.example.test/dev/api');
    setSessionGetter(
      async () =>
        ({
          accessToken: 'test-jwt-token',
          expires: '2099-01-01T00:00:00.000Z',
        }) as Session
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setSessionGetter(() => Promise.resolve(null));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('constructs exact /dev/api/v1/users/{user_id}/favorite-mentors URLs with Bearer token and zero double /api prefix', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          code: '0',
          msg: 'ok',
          data: [
            {
              user_id: 101,
              name: '王小明',
              avatar: '',
              job_title: 'Senior Backend Engineer',
              company: 'Example Inc.',
              years_of_experience: '8',
              have_skill: ['python'],
              have_topic: ['career'],
              updated_at: '2026-11-14T08:00:00Z',
              stats: {
                completed_meeting_count: 12,
                total_rating_count: 3,
                rating_average: 9.0,
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { code: '0', msg: 'ok', data: null })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { code: '0', msg: 'ok', data: null })
      );
    global.fetch = fetchSpy;

    const list = await fetchFavoriteMentors('9001');
    await addFavoriteMentor('9001', 101);
    await removeFavoriteMentor('9001', 101);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://bff.example.test/dev/api/v1/users/9001/favorite-mentors',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://bff.example.test/dev/api/v1/users/9001/favorite-mentors/101',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'https://bff.example.test/dev/api/v1/users/9001/favorite-mentors/101',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      })
    );

    expect(list).toHaveLength(1);
    expect(list[0]?.stats).toEqual({
      completed_meeting_count: 12,
      rating_count: 3,
      rating_average: 9.0,
    });
  });

  it('handles HTTP 404 asymmetrically per contract: GET 404 returns [], while PUT/DELETE 404 throws ApiError', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { detail: 'Not Found' }))
      .mockResolvedValueOnce(
        jsonResponse(404, {
          code: '1',
          msg: 'mentor_not_found',
          data: {
            type: 'mentor_not_found',
            message: 'Target mentor does not exist',
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse(404, { detail: 'Not Found' }));
    global.fetch = fetchSpy;

    await expect(fetchFavoriteMentors('9001')).resolves.toEqual([]);

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: '1',
      data: {
        type: 'mentor_not_found',
        message: 'Target mentor does not exist',
      },
    });

    await expect(removeFavoriteMentor('9001', 101)).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('parses HTTP 403 (code "40300"), HTTP 400 business rules (code "1" + data.type), and HTTP 422 FastAPI validation errors into ApiError', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(403, {
          code: '40300',
          msg: 'user_id not match',
          data: null,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(400, {
          code: '1',
          msg: '',
          data: {
            type: 'profile_required',
            message: 'User has not completed onboarding',
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(422, {
          detail: [
            {
              loc: ['path', 'mentor_id'],
              msg: 'Input should be a valid integer',
            },
          ],
        })
      );
    global.fetch = fetchSpy;

    await expect(fetchFavoriteMentors('9001')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: '40300',
      message: 'user_id not match',
    });

    await expect(addFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: '1',
      message: 'User has not completed onboarding',
      data: {
        type: 'profile_required',
        message: 'User has not completed onboarding',
      },
    });

    await expect(removeFavoriteMentor('9001', 101)).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'path.mentor_id: Input should be a valid integer',
    });
  });
});

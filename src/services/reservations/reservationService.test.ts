import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
  FetchApiError: class FetchApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly path: string
    ) {
      super(`fetch ${path} API error (${code}): ${message}`);
      this.name = 'FetchApiError';
    }
  },
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

import { apiClient, FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { components } from '@/types/api';

import {
  createReservation,
  fetchAllReservationsForState,
  fetchReservations,
  updateReservationStatus,
} from './reservationService';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const mockPost = vi.mocked(apiClient.post);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

function makeApiReservation(
  overrides: Partial<components['schemas']['ReservationInfoVO']> = {}
): components['schemas']['ReservationInfoVO'] {
  return {
    id: 1,
    sender: {
      user_id: 1,
      role: 'MENTEE',
      status: 'ACCEPT',
      name: 'Mentee',
      avatar: '',
      job_title: '',
      years_of_experience: '',
    },
    participant: {
      user_id: 2,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Mentor',
      avatar: '',
      job_title: '',
      years_of_experience: '',
    },
    schedule_id: 1,
    dtstart: 100,
    dtend: 200,
    previous_reserve: null,
    messages: [],
    ...overrides,
  };
}

describe('reservationService API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReservation', () => {
    it('should throw FetchApiError with correct code, message and path if API returns non-0 code', async () => {
      mockPost.mockResolvedValue({
        code: '409',
        msg: 'Conflict booking',
        data: null,
      });

      await expect(
        createReservation({
          userId: 123,
          body: {} as unknown as components['schemas']['ReservationDTO'],
        })
      ).rejects.toThrow(FetchApiError);

      try {
        await createReservation({
          userId: 123,
          body: {} as unknown as components['schemas']['ReservationDTO'],
        });
      } catch (err) {
        expect(err).toBeInstanceOf(FetchApiError);
        const apiError = err as FetchApiError;
        expect(apiError.code).toBe('409');
        expect(apiError.message).toContain('Conflict booking');
        expect(apiError.path).toBe('/v1/users/123/reservations');
      }
    });

    it('should return data successfully if code is 0', async () => {
      const mockResult = { id: 789 };
      mockPost.mockResolvedValue({
        code: '0',
        msg: 'success',
        data: mockResult,
      });

      const res = await createReservation({
        userId: 123,
        body: {} as unknown as components['schemas']['ReservationDTO'],
      });

      expect(res).toEqual(mockResult);
    });
  });

  describe('updateReservationStatus', () => {
    it('should throw FetchApiError with correct code, message and path if API returns non-0 code', async () => {
      mockPut.mockResolvedValue({
        code: '500',
        msg: 'Internal Server Error',
        data: null,
      });

      await expect(
        updateReservationStatus({
          userId: 123,
          reservationId: 456,
          body: {} as unknown as components['schemas']['UpdateReservationDTO'],
        })
      ).rejects.toThrow(FetchApiError);

      try {
        await updateReservationStatus({
          userId: 123,
          reservationId: 456,
          body: {} as unknown as components['schemas']['UpdateReservationDTO'],
        });
      } catch (err) {
        expect(err).toBeInstanceOf(FetchApiError);
        const apiError = err as FetchApiError;
        expect(apiError.code).toBe('500');
        expect(apiError.message).toContain('Internal Server Error');
        expect(apiError.path).toBe('/v1/users/123/reservations/456');
      }
    });
  });

  describe('fetchReservations', () => {
    it('should throw FetchApiError with correct code, message and path if API returns non-0 code', async () => {
      mockGet.mockResolvedValue({
        code: '400',
        msg: 'Bad Request',
        data: null,
      });

      await expect(
        fetchReservations({
          userId: 123,
          state: 'MENTEE_PENDING',
        })
      ).rejects.toThrow(FetchApiError);

      try {
        await fetchReservations({
          userId: 123,
          state: 'MENTEE_PENDING',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(FetchApiError);
        const apiError = err as FetchApiError;
        expect(apiError.code).toBe('400');
        expect(apiError.message).toContain('Bad Request');
        expect(apiError.path).toBe('/v1/users/123/reservations');
      }
    });
  });

  describe('fetchAllReservationsForState', () => {
    it('returns the single page when next_dtend is 0', async () => {
      mockGet.mockResolvedValue({
        code: '0',
        msg: 'ok',
        data: {
          reservations: [
            makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
          ],
          next_dtend: 0,
        },
      });

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        1000
      );

      expect(result).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('pages via next_dtend until the backend signals no more pages', async () => {
      mockGet
        .mockResolvedValueOnce({
          code: '0',
          msg: 'ok',
          data: {
            reservations: [
              makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
            ],
            next_dtend: 300,
          },
        })
        .mockResolvedValueOnce({
          code: '0',
          msg: 'ok',
          data: {
            reservations: [
              makeApiReservation({ id: 2, dtstart: 300, dtend: 400 }),
            ],
            next_dtend: 0,
          },
        });

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        100000
      );

      expect(result).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ next_dtend: 300 }),
        })
      );
    });

    it('stops when next_dtend repeats the same cursor (stuck-cursor guard)', async () => {
      mockGet
        .mockResolvedValueOnce({
          code: '0',
          msg: 'ok',
          data: {
            reservations: [
              makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
            ],
            next_dtend: 300,
          },
        })
        .mockResolvedValue({
          code: '0',
          msg: 'ok',
          data: { reservations: [], next_dtend: 300 },
        });

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        100000
      );

      expect(result).toHaveLength(1);
      // Initial call plus one follow-up that received the repeated cursor
      // and stopped — never a third call.
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('stops when next_dtend moves past the end of the target month', async () => {
      mockGet.mockResolvedValue({
        code: '0',
        msg: 'ok',
        data: {
          reservations: [
            makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
          ],
          next_dtend: 99999,
        },
      });

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        1000
      );

      expect(result).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('swallows a fetch failure, returns items already collected, and reports via captureFlowFailure', async () => {
      mockGet.mockRejectedValue(new Error('network down'));

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        1000
      );

      expect(result).toEqual([]);
      expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'mentor_schedule_reservations_fetch',
          step: 'fetch_MENTOR_UPCOMING',
        })
      );
    });
  });
});

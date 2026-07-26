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

import { apiClient, FetchApiError } from '@/lib/apiClient';
import { components } from '@/types/api';

import {
  createReservation,
  fetchReservations,
  updateReservationStatus,
} from './reservationService';

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);
const mockPost = vi.mocked(apiClient.post);

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
});

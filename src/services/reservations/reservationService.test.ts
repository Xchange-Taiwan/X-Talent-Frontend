import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      getUnwrapped: vi.fn(),
      putUnwrapped: vi.fn(),
      postUnwrapped: vi.fn(),
    },
  };
});

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
  captureApiFailure: vi.fn(),
}));

import { apiClient, ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { components } from '@/types/api';

import {
  createReservation,
  fetchAllReservationsForState,
  fetchReservationFeedback,
  fetchReservationMeetLink,
  fetchReservations,
  invalidateReservationRead,
  mapToReservation,
  postReservationFeedback,
  putReservationFeedback,
  updateReservationStatus,
} from './reservationService';

const mockGet = vi.mocked(apiClient.getUnwrapped);
const mockPut = vi.mocked(apiClient.putUnwrapped);
const mockPost = vi.mocked(apiClient.postUnwrapped);
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
    vi.resetAllMocks();
    reservationReadModel.clear();
  });

  describe('createReservation', () => {
    it('should throw ApiError with correct status and message if API returns non-0 code', async () => {
      mockPost.mockRejectedValue(new ApiError(409, 'Conflict booking'));

      await expect(
        createReservation({
          userId: 123,
          body: fromPartial<components['schemas']['ReservationDTO']>({}),
        })
      ).rejects.toThrow(ApiError);

      try {
        await createReservation({
          userId: 123,
          body: fromPartial<components['schemas']['ReservationDTO']>({}),
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.status).toBe(409);
          expect(err.message).toContain('Conflict booking');
        }
      }
    });

    it('should return data successfully if code is 0', async () => {
      const mockResult = fromPartial<components['schemas']['ReservationVO']>({
        id: 789,
      });
      mockPost.mockResolvedValue(mockResult);

      const res = await createReservation({
        userId: 123,
        body: fromPartial<components['schemas']['ReservationDTO']>({}),
      });

      expect(res).toEqual(mockResult);
    });

    it('invalidates the booking mentee and target mentor PENDING reads on success (X-Tracker #651)', async () => {
      mockPost.mockResolvedValue(
        fromPartial<components['schemas']['ReservationVO']>({
          id: 789,
        })
      );
      reservationReadModel.set(
        { userId: '123', state: 'MENTEE_PENDING' },
        { items: [], next_dtend: 0 }
      );
      reservationReadModel.set(
        { userId: '456', state: 'MENTOR_PENDING' },
        { items: [], next_dtend: 0 }
      );

      await createReservation({
        userId: 123,
        body: fromPartial<components['schemas']['ReservationDTO']>({
          user_id: 456,
        }),
      });

      expect(
        reservationReadModel.get({ userId: '123', state: 'MENTEE_PENDING' })
      ).toBeUndefined();
      expect(
        reservationReadModel.get({ userId: '456', state: 'MENTOR_PENDING' })
      ).toBeUndefined();
    });
  });

  describe('invalidateReservationRead', () => {
    it('drops the cache entry directly when nothing is subscribed to it', () => {
      const key = { userId: '1', state: 'MENTEE_PENDING' } as const;
      reservationReadModel.set(key, { items: [], next_dtend: 0 });

      invalidateReservationRead(key);

      expect(reservationReadModel.get(key)).toBeUndefined();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('refreshes the key in place with a fresh fetch when a component is actively subscribed', async () => {
      const key = { userId: '1', state: 'MENTEE_PENDING' } as const;
      reservationReadModel.set(key, { items: [], next_dtend: 0 });
      const unsubscribe = reservationReadModel.subscribe(
        key,
        () => new Promise(() => {}),
        () => {}
      );
      mockGet.mockResolvedValue({
        reservations: [makeApiReservation({ id: 42 })],
        next_dtend: 0,
      });

      invalidateReservationRead(key);

      await vi.waitFor(() => {
        expect(reservationReadModel.get(key)?.items).toHaveLength(1);
      });
      expect(reservationReadModel.get(key)?.items[0].id).toBe('42');

      unsubscribe();
    });

    it('reports (and swallows) a failed background refresh via captureFlowFailure', async () => {
      const key = { userId: '1', state: 'MENTEE_PENDING' } as const;
      const unsubscribe = reservationReadModel.subscribe(
        key,
        () => new Promise(() => {}),
        () => {}
      );
      mockGet.mockRejectedValue(new Error('network down'));

      invalidateReservationRead(key);

      await vi.waitFor(() => {
        expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
          expect.objectContaining({
            flow: 'reservation_mutation_invalidate',
            step: 'refresh_MENTEE_PENDING',
          })
        );
      });

      unsubscribe();
    });

    it('refreshes subscribed month-scoped calendar slices when invalidated with an unscoped key', async () => {
      const scopedKey = {
        userId: '1',
        state: 'MENTOR_PENDING',
        endOfMonthUnix: 2000,
      } as const;
      reservationReadModel.set(scopedKey, { items: [], next_dtend: 0 });
      const unsubscribe = reservationReadModel.subscribe(
        scopedKey,
        () => new Promise(() => {}),
        () => {}
      );
      mockGet.mockResolvedValue({
        reservations: [
          makeApiReservation({ id: 99, dtstart: 100, dtend: 200 }),
        ],
        next_dtend: 0,
      });

      invalidateReservationRead({ userId: '1', state: 'MENTOR_PENDING' });

      await vi.waitFor(() => {
        expect(reservationReadModel.get(scopedKey)?.items).toHaveLength(1);
      });
      expect(reservationReadModel.get(scopedKey)?.items[0].id).toBe('99');

      unsubscribe();
    });
  });

  describe('updateReservationStatus', () => {
    it('should throw ApiError with correct status and message if API returns non-0 code', async () => {
      mockPut.mockRejectedValue(new ApiError(500, 'Internal Server Error'));

      await expect(
        updateReservationStatus({
          userId: 123,
          reservationId: 456,
          body: fromPartial<components['schemas']['UpdateReservationDTO']>({}),
        })
      ).rejects.toThrow(ApiError);

      try {
        await updateReservationStatus({
          userId: 123,
          reservationId: 456,
          body: fromPartial<components['schemas']['UpdateReservationDTO']>({}),
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.status).toBe(500);
          expect(err.message).toContain('Internal Server Error');
        }
      }
    });
  });

  describe('fetchReservations', () => {
    it('should throw ApiError with correct status and message if API returns non-0 code', async () => {
      mockGet.mockRejectedValue(new ApiError(400, 'Bad Request'));

      await expect(
        fetchReservations({
          userId: 123,
          state: 'MENTEE_PENDING',
        })
      ).rejects.toThrow(ApiError);

      try {
        await fetchReservations({
          userId: 123,
          state: 'MENTEE_PENDING',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.status).toBe(400);
          expect(err.message).toContain('Bad Request');
        }
      }
    });
  });

  describe('fetchReservationMeetLink', () => {
    it('should throw ApiError with correct status and message if API returns non-0 code', async () => {
      mockGet.mockRejectedValue(new ApiError(404, 'meet link not found'));

      await expect(
        fetchReservationMeetLink({
          userId: 123,
          reservationId: 456,
        })
      ).rejects.toThrow(ApiError);

      try {
        await fetchReservationMeetLink({
          userId: 123,
          reservationId: 456,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        if (err instanceof ApiError) {
          expect(err.status).toBe(404);
          expect(err.message).toContain('meet link not found');
        }
      }
    });

    it('should return meet_url successfully if code is 0', async () => {
      const mockResult = { meet_url: 'https://meet.google.com/xxx-yyyy-zzz' };
      mockGet.mockResolvedValue(mockResult);

      const res = await fetchReservationMeetLink({
        userId: 123,
        reservationId: 456,
      });

      expect(res).toEqual(mockResult);
    });
  });

  describe('fetchAllReservationsForState', () => {
    it('returns the single page when next_dtend is 0', async () => {
      mockGet.mockResolvedValue({
        reservations: [makeApiReservation({ id: 1, dtstart: 100, dtend: 200 })],
        next_dtend: 0,
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
          reservations: [
            makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
          ],
          next_dtend: 300,
        })
        .mockResolvedValueOnce({
          reservations: [
            makeApiReservation({ id: 2, dtstart: 300, dtend: 400 }),
          ],
          next_dtend: 0,
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
          reservations: [
            makeApiReservation({ id: 1, dtstart: 100, dtend: 200 }),
          ],
          next_dtend: 300,
        })
        .mockResolvedValue({ reservations: [], next_dtend: 300 });

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
        reservations: [makeApiReservation({ id: 1, dtstart: 100, dtend: 200 })],
        next_dtend: 99999,
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

    it('stops after MAX_PAGES when the cursor keeps advancing without repeating or crossing the month boundary, and reports it', async () => {
      // Cursor inches forward by 1 every page, never repeats, and never
      // reaches endOfMonthUnix — only the page-count ceiling can end this.
      mockGet.mockImplementation(async (_path, options) => {
        const nextDtend = Number(options?.params?.next_dtend ?? 0);
        return {
          reservations: [
            makeApiReservation({
              id: nextDtend + 1,
              dtstart: 100,
              dtend: 200,
            }),
          ],
          next_dtend: nextDtend + 1,
        };
      });

      const result = await fetchAllReservationsForState(
        '123',
        'MENTOR_UPCOMING',
        Number.MAX_SAFE_INTEGER
      );

      expect(result).toHaveLength(50);
      expect(mockGet).toHaveBeenCalledTimes(50);
      expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'mentor_schedule_reservations_fetch',
          step: 'fetch_MENTOR_UPCOMING_max_pages_exceeded',
        })
      );
    });

    it('supports options object without endOfMonthUnix and stops early when shouldStop matches (#733)', async () => {
      mockGet
        .mockResolvedValueOnce({
          reservations: [
            makeApiReservation({ id: 201, dtstart: 1000, dtend: 2000 }),
          ],
          next_dtend: 900,
        })
        .mockResolvedValueOnce({
          reservations: [
            makeApiReservation({ id: 202, dtstart: 800, dtend: 900 }),
          ],
          next_dtend: 700,
        })
        .mockResolvedValueOnce({
          reservations: [
            makeApiReservation({ id: 203, dtstart: 600, dtend: 700 }),
          ],
          next_dtend: 0,
        });

      const controller = new AbortController();
      const result = await fetchAllReservationsForState({
        userId: '123',
        state: 'MENTOR_HISTORY',
        signal: controller.signal,
        shouldStop: (items) => items.some((it) => it.id === '202'),
      });

      expect(result.map((it) => it.id)).toEqual(['201', '202']);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('returns items collected so far without reporting failure when aborted via signal (#733)', async () => {
      const controller = new AbortController();
      mockGet
        .mockResolvedValueOnce({
          reservations: [
            makeApiReservation({ id: 201, dtstart: 1000, dtend: 2000 }),
          ],
          next_dtend: 900,
        })
        .mockImplementationOnce(async () => {
          controller.abort();
          throw new DOMException('Aborted', 'AbortError');
        });

      const result = await fetchAllReservationsForState({
        userId: '123',
        state: 'MENTOR_HISTORY',
        signal: controller.signal,
      });

      expect(result.map((it) => it.id)).toEqual(['201']);
      expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
    });
  });

  describe('feedback mapping & postReservationFeedback (#730)', () => {
    it('maps feedback with rating, is_public, and next_step when present and omits feedback gracefully when absent', () => {
      const withoutFeedback = mapToReservation(makeApiReservation(), 1);
      expect(withoutFeedback.feedback).toBeUndefined();

      const withUnpublicizedFeedback = mapToReservation(
        {
          ...makeApiReservation(),
          feedback: {
            meeting_happened: false,
            rating: {
              rating: 8,
              content: '感謝分享',
              created_at: 1760000000,
              updated_at: 1760000500,
              author_name: '王＊明',
              is_public: false,
            },
            next_step: null,
          },
        },
        1
      );

      expect(withUnpublicizedFeedback.feedback).toEqual({
        meetingHappened: false,
        rating: {
          rating: 8,
          content: '感謝分享',
          createdAt: 1760000000,
          updatedAt: 1760000500,
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      });
    });

    it('calls POST /v1/users/:userId/reservations/:reservationId/feedback via apiClient.postUnwrapped', async () => {
      mockPost.mockResolvedValueOnce({ ok: true });

      await postReservationFeedback({
        userId: '1',
        reservationId: '42',
        body: {
          meeting_happened: true,
          feedback: { rating: 10, content: '非常棒！' },
        },
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/users/1/reservations/42/feedback',
        {
          meeting_happened: true,
          feedback: { rating: 10, content: '非常棒！' },
        }
      );
    });

    it('calls PUT /v1/users/:userId/reservations/:reservationId/feedback with { rating, content } via apiClient.putUnwrapped (#731)', async () => {
      mockPut.mockResolvedValueOnce({ ok: true });

      await putReservationFeedback({
        userId: '1',
        reservationId: '42',
        body: {
          rating: 8,
          content: '更新後的回饋內容',
        },
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/v1/users/1/reservations/42/feedback',
        {
          rating: 8,
          content: '更新後的回饋內容',
        }
      );
    });

    it('fetches single reservation feedback via GET /v1/users/:userId/reservations/:reservationId/feedback (#733)', async () => {
      mockGet.mockResolvedValueOnce({
        meeting_happened: null,
        rating: null,
        next_step: 'ANSWER',
        role: 'MENTEE',
      });

      const result = await fetchReservationFeedback({
        userId: '1',
        reservationId: '101',
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/v1/users/1/reservations/101/feedback',
        {}
      );
      expect(result).toEqual({
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
        viewerRole: 'mentee',
      });
    });

    it('supports nested feedback payload, viewer_role normalization, and AbortSignal forwarding (#733)', async () => {
      const controller = new AbortController();
      mockGet.mockResolvedValueOnce({
        viewer_role: 'MENTOR',
        feedback: {
          meeting_happened: true,
          rating: null,
          next_step: null,
        },
      });

      const result = await fetchReservationFeedback({
        userId: '99',
        reservationId: '202',
        signal: controller.signal,
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/v1/users/99/reservations/202/feedback',
        { signal: controller.signal }
      );
      expect(result).toEqual({
        feedback: {
          meetingHappened: true,
          rating: null,
          nextStep: null,
        },
        viewerRole: 'mentor',
      });
    });

    it('returns null gracefully for 404/405/501 or empty payloads and rethrows 500 errors (#733)', async () => {
      mockGet.mockRejectedValueOnce(new ApiError(404, 'Not Found'));
      await expect(
        fetchReservationFeedback({ userId: '1', reservationId: '101' })
      ).resolves.toBeNull();

      mockGet.mockRejectedValueOnce(new ApiError(405, 'Method Not Allowed'));
      await expect(
        fetchReservationFeedback({ userId: '1', reservationId: '101' })
      ).resolves.toBeNull();

      mockGet.mockRejectedValueOnce(new ApiError(501, 'Not Implemented'));
      await expect(
        fetchReservationFeedback({ userId: '1', reservationId: '101' })
      ).resolves.toBeNull();

      mockGet.mockResolvedValueOnce({});
      await expect(
        fetchReservationFeedback({ userId: '1', reservationId: '101' })
      ).resolves.toBeNull();

      mockGet.mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'));
      await expect(
        fetchReservationFeedback({ userId: '1', reservationId: '101' })
      ).rejects.toThrow('Internal Server Error');
    });
  });
});

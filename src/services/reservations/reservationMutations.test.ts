import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

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

vi.mock('@/lib/monitoring', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
    captureApiFailure: vi.fn(),
  };
});

vi.mock('@/lib/analytics', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

import { apiClient, ApiError } from '@/lib/apiClient';
import { mentorPoolReadManager } from '@/lib/cache/mentorPoolCache';
import { captureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import { subscribeMentorFeedbackInvalidation } from '@/services/profile/feedback';
import {
  acceptReservation,
  getReservationErrorMessage,
  rejectOrCancelReservation,
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
  submitReservationFeedback,
  updateReservationFeedback,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

const mockGet = vi.mocked(apiClient.getUnwrapped);
const mockPut = vi.mocked(apiClient.putUnwrapped);
const mockPost = vi.mocked(apiClient.postUnwrapped);
const mockCaptureFailure = vi.mocked(captureFlowFailure);

const emptyPage = { items: [], next_dtend: 0 };

const makeMockReservation = (
  overrides: Partial<Reservation> = {}
): Reservation => ({
  id: 'res-123',
  name: 'Test Mentor',
  roleLine: 'Designer, 1~3 年',
  date: 'Mon, Jan 01, 2024',
  time: '9:00 am – 10:00 am',
  messages: [],
  scheduleId: 101,
  dtstart: 1704099600,
  dtend: 1704103200,
  senderUserId: 'user-sender',
  participantUserId: 'user-participant',
  version: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReturnValue(new Promise(() => {}));
  reservationReadModel.clear();
});

describe('getReservationErrorMessage', () => {
  it('returns the shared conflict message for a version conflict error', () => {
    expect(
      getReservationErrorMessage(
        new ReservationVersionConflictError(),
        '接受預約失敗,請稍後再試'
      )
    ).toBe(RESERVATION_CONFLICT_MESSAGE);
  });

  it('returns the fallback message for any other error', () => {
    expect(
      getReservationErrorMessage(new Error('boom'), '接受預約失敗,請稍後再試')
    ).toBe('接受預約失敗,請稍後再試');
  });

  it('returns the fallback message for a non-Error thrown value', () => {
    expect(getReservationErrorMessage('boom', '取消預約失敗,請稍後再試')).toBe(
      '取消預約失敗,請稍後再試'
    );
  });
});

describe('resolveCounterpartyId', () => {
  it('should resolve to participantUserId if current user is the sender', () => {
    const res = makeMockReservation({
      senderUserId: 'user-sender',
      participantUserId: 'user-participant',
    });
    const result = resolveCounterpartyId(res, 'user-sender');
    expect(result).toBe('user-participant');
  });

  it('should resolve to senderUserId if current user is the participant', () => {
    const res = makeMockReservation({
      senderUserId: 'user-sender',
      participantUserId: 'user-participant',
    });
    const result = resolveCounterpartyId(res, 'user-participant');
    expect(result).toBe('user-sender');
  });
});

describe('acceptReservation', () => {
  it('should call updateReservationStatus with ACCEPT status', async () => {
    const reservation = makeMockReservation({
      scheduleId: 101,
      dtstart: 1704099600,
      dtend: 1704103200,
      senderUserId: '10',
      participantUserId: '20',
    });

    mockPut.mockResolvedValue({
      code: '0',
      msg: 'success',
      data: {},
    });

    await acceptReservation({
      message: 'Looking forward to meeting you!',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledWith('/v1/users/10/reservations/res-123', {
      my_user_id: 10,
      user_id: 20,
      my_status: 'ACCEPT',
      schedule_id: 101,
      dtstart: 1704099600,
      dtend: 1704103200,
      messages: [{ user_id: 10, content: 'Looking forward to meeting you!' }],
      version: 0,
    });
  });

  it('should omit messages array if accepted without a message', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });

    mockPut.mockResolvedValue({
      code: '0',
      msg: 'success',
      data: {},
    });

    await acceptReservation({
      message: '  ',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    expect(mockPut).toHaveBeenCalledWith(
      '/v1/users/10/reservations/res-123',
      expect.objectContaining({
        messages: [],
      })
    );
  });

  it('should capture failure and rethrow when API fails', async () => {
    const reservation = makeMockReservation();
    const testError = new Error('API failed');
    mockPut.mockRejectedValue(testError);

    await expect(
      acceptReservation({
        message: 'hello',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toThrow('API failed');

    expect(mockCaptureFailure).toHaveBeenCalledTimes(1);
    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_accept',
      step: 'update_status',
      message: 'API failed',
    });
  });

  it('should throw error if myUserId is missing', async () => {
    const reservation = makeMockReservation();
    await expect(
      acceptReservation({
        message: 'hello',
        reservation,
        myUserId: '',
        myRole: 'mentor',
      })
    ).rejects.toThrow('[reservationMutations] missing current user id');
  });

  it('should throw ReservationVersionConflictError, skip Sentry capture, and invalidate both unscoped and month-scoped slices on 409', async () => {
    const reservation = makeMockReservation({
      version: 3,
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockRejectedValue(new ApiError(409, 'version conflict'));

    const unscopedPending = { userId: '10', state: 'MENTOR_PENDING' } as const;
    const scopedPending = {
      userId: '10',
      state: 'MENTOR_PENDING',
      endOfMonthUnix: 1706745599,
    } as const;
    const unscopedUpcoming = {
      userId: '10',
      state: 'MENTOR_UPCOMING',
    } as const;
    reservationReadModel.set(unscopedPending, emptyPage);
    reservationReadModel.set(scopedPending, emptyPage);
    reservationReadModel.set(unscopedUpcoming, emptyPage);

    await expect(
      acceptReservation({
        message: 'hello',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(mockCaptureFailure).not.toHaveBeenCalled();
    expect(reservationReadModel.get(unscopedPending)).toBeUndefined();
    expect(reservationReadModel.get(scopedPending)).toBeUndefined();
    expect(reservationReadModel.get(unscopedUpcoming)).toBeUndefined();
  });

  it('optimistically evicts the reservation from subscribed PENDING slices and invalidates unsubscribed slices on 200 OK', async () => {
    const reservation = makeMockReservation({
      id: 'res-123',
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockResolvedValue({ code: '0', msg: 'success', data: {} });

    const subscribedPending = {
      userId: '10',
      state: 'MENTOR_PENDING',
    } as const;
    reservationReadModel.set(subscribedPending, {
      items: [reservation],
      next_dtend: 0,
    });
    const unsubscribe = reservationReadModel.subscribe(
      subscribedPending,
      () => new Promise(() => {}),
      () => {}
    );

    await acceptReservation({
      message: 'hello',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    expect(reservationReadModel.get(subscribedPending)?.items).toEqual([]);
    unsubscribe();
  });

  it('invalidates both parties PENDING + UPCOMING reads on success (X-Tracker #651)', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockResolvedValue({ code: '0', msg: 'success', data: {} });

    const keys = [
      { userId: '10', state: 'MENTOR_PENDING' },
      { userId: '10', state: 'MENTOR_UPCOMING' },
      { userId: '20', state: 'MENTEE_PENDING' },
      { userId: '20', state: 'MENTEE_UPCOMING' },
    ] as const;
    keys.forEach((key) => reservationReadModel.set(key, emptyPage));
    // A state neither party's role occupies for this reservation must
    // survive untouched.
    reservationReadModel.set(
      { userId: '10', state: 'MENTOR_HISTORY' },
      emptyPage
    );

    await acceptReservation({
      message: 'hello',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    keys.forEach((key) => {
      expect(reservationReadModel.get(key)).toBeUndefined();
    });
    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTOR_HISTORY' })
    ).toEqual(emptyPage);
  });

  it('invalidates the counterparty as MENTOR when myRole is mentee', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockResolvedValue({ code: '0', msg: 'success', data: {} });

    reservationReadModel.set(
      { userId: '10', state: 'MENTEE_PENDING' },
      emptyPage
    );
    reservationReadModel.set(
      { userId: '20', state: 'MENTOR_UPCOMING' },
      emptyPage
    );

    await acceptReservation({
      message: 'hello',
      reservation,
      myUserId: '10',
      myRole: 'mentee',
    });

    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTEE_PENDING' })
    ).toBeUndefined();
    expect(
      reservationReadModel.get({ userId: '20', state: 'MENTOR_UPCOMING' })
    ).toBeUndefined();
  });

  it('does not invalidate anything when the API call fails', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockRejectedValue(new Error('API failed'));
    reservationReadModel.set(
      { userId: '10', state: 'MENTOR_PENDING' },
      emptyPage
    );

    await expect(
      acceptReservation({
        message: 'hello',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toThrow('API failed');

    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTOR_PENDING' })
    ).toEqual(emptyPage);
  });
});

describe('rejectOrCancelReservation', () => {
  it('should call updateReservationStatus with REJECT status', async () => {
    const reservation = makeMockReservation({
      scheduleId: 101,
      dtstart: 1704099600,
      dtend: 1704103200,
      senderUserId: '10',
      participantUserId: '20',
    });

    mockPut.mockResolvedValue({
      code: '0',
      msg: 'success',
      data: {},
    });

    await rejectOrCancelReservation({
      text: 'Sorry, I am busy',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledWith('/v1/users/10/reservations/res-123', {
      my_user_id: 10,
      user_id: 20,
      my_status: 'REJECT',
      schedule_id: 101,
      dtstart: 1704099600,
      dtend: 1704103200,
      messages: [{ user_id: 10, content: 'Sorry, I am busy' }],
      version: 0,
    });
  });

  it('should capture failure and rethrow when API fails on rejectOrCancel', async () => {
    const reservation = makeMockReservation();
    const testError = new Error('Reject failed');
    mockPut.mockRejectedValue(testError);

    await expect(
      rejectOrCancelReservation({
        text: 'reason',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toThrow('Reject failed');

    expect(mockCaptureFailure).toHaveBeenCalledTimes(1);
    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_reject',
      step: 'update_status',
      message: 'Reject failed',
    });
  });

  it('should throw error if myUserId is missing', async () => {
    const reservation = makeMockReservation();
    await expect(
      rejectOrCancelReservation({
        text: 'cancel',
        reservation,
        myUserId: '',
        myRole: 'mentor',
      })
    ).rejects.toThrow('[reservationMutations] missing current user id');
  });

  it('should throw ReservationVersionConflictError, skip Sentry capture, and invalidate both unscoped and month-scoped slices on 409', async () => {
    const reservation = makeMockReservation({
      version: 3,
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockRejectedValue(new ApiError(409, 'version conflict'));

    const unscopedUpcoming = {
      userId: '10',
      state: 'MENTOR_UPCOMING',
    } as const;
    const scopedUpcoming = {
      userId: '10',
      state: 'MENTOR_UPCOMING',
      endOfMonthUnix: 1706745599,
    } as const;
    reservationReadModel.set(unscopedUpcoming, emptyPage);
    reservationReadModel.set(scopedUpcoming, emptyPage);

    await expect(
      rejectOrCancelReservation({
        text: 'reason',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(mockCaptureFailure).not.toHaveBeenCalled();
    expect(reservationReadModel.get(unscopedUpcoming)).toBeUndefined();
    expect(reservationReadModel.get(scopedUpcoming)).toBeUndefined();
  });

  it('invalidates both parties PENDING + UPCOMING + HISTORY reads on success (X-Tracker #651)', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockResolvedValue({ code: '0', msg: 'success', data: {} });

    const keys = [
      { userId: '10', state: 'MENTOR_PENDING' },
      { userId: '10', state: 'MENTOR_UPCOMING' },
      { userId: '10', state: 'MENTOR_HISTORY' },
      { userId: '20', state: 'MENTEE_PENDING' },
      { userId: '20', state: 'MENTEE_UPCOMING' },
      { userId: '20', state: 'MENTEE_HISTORY' },
    ] as const;
    keys.forEach((key) => reservationReadModel.set(key, emptyPage));

    await rejectOrCancelReservation({
      text: 'reason',
      reservation,
      myUserId: '10',
      myRole: 'mentor',
    });

    keys.forEach((key) => {
      expect(reservationReadModel.get(key)).toBeUndefined();
    });
  });

  it('does not invalidate anything when the API call fails', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPut.mockRejectedValue(new Error('Reject failed'));
    reservationReadModel.set(
      { userId: '10', state: 'MENTOR_PENDING' },
      emptyPage
    );

    await expect(
      rejectOrCancelReservation({
        text: 'reason',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toThrow('Reject failed');

    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTOR_PENDING' })
    ).toEqual(emptyPage);
  });
});

describe('submitReservationFeedback (#730)', () => {
  let clearPoolSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    reservationReadModel.clear();
    mentorPoolReadManager.clear();
    clearPoolSpy = vi.spyOn(mentorPoolReadManager, 'clear');
  });

  afterEach(() => {
    clearPoolSpy.mockRestore();
  });

  it('posts meeting_happened=true feedback, invalidates both parties HISTORY slices, and clears mentorPoolReadManager', async () => {
    const reservation = makeMockReservation({
      id: 'res-730',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    mockPost.mockResolvedValueOnce({ ok: true });

    reservationReadModel.set(
      { userId: '10', state: 'MENTEE_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );
    reservationReadModel.set(
      { userId: '20', state: 'MENTOR_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );

    await submitReservationFeedback({
      reservation,
      myUserId: '10',
      myRole: 'mentee',
      payload: {
        meeting_happened: true,
        feedback: { rating: 10, content: '收穫良多！' },
      },
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/users/10/reservations/res-730/feedback',
      {
        meeting_happened: true,
        feedback: { rating: 10, content: '收穫良多！' },
      }
    );
    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTEE_HISTORY' })
    ).toBeUndefined();
    expect(
      reservationReadModel.get({ userId: '20', state: 'MENTOR_HISTORY' })
    ).toBeUndefined();
    expect(clearPoolSpy).toHaveBeenCalledTimes(1);
  });

  it('posts meeting_happened=false with not_happened_reason, invalidates both parties HISTORY slices, and does not clear mentorPoolReadManager', async () => {
    const reservation = makeMockReservation({
      id: 'res-730-absent',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    mockPost.mockResolvedValueOnce({ ok: true });

    reservationReadModel.set(
      { userId: '10', state: 'MENTEE_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );
    reservationReadModel.set(
      { userId: '20', state: 'MENTOR_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );

    await submitReservationFeedback({
      reservation,
      myUserId: '10',
      myRole: 'mentee',
      payload: {
        meeting_happened: false,
        not_happened_reason: 'MENTOR_ABSENT',
      },
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/users/10/reservations/res-730-absent/feedback',
      {
        meeting_happened: false,
        not_happened_reason: 'MENTOR_ABSENT',
      }
    );
    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTEE_HISTORY' })
    ).toBeUndefined();
    expect(
      reservationReadModel.get({ userId: '20', state: 'MENTOR_HISTORY' })
    ).toBeUndefined();
    expect(clearPoolSpy).not.toHaveBeenCalled();
  });

  it('optimistically updates subscribed MENTEE_HISTORY slice in place before background refresh settles', async () => {
    const reservation = makeMockReservation({
      id: 'res-730-live',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    const untouched = makeMockReservation({
      id: 'res-other',
      senderUserId: '10',
      participantUserId: '30',
    });
    mockPost.mockResolvedValueOnce({ ok: true });

    const subscribedHistory = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    reservationReadModel.set(subscribedHistory, {
      items: [reservation, untouched],
      next_dtend: 0,
    });
    const unsubscribe = reservationReadModel.subscribe(
      subscribedHistory,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await submitReservationFeedback({
        reservation,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 9, content: '非常實用！' },
        },
      });

      const updatedItems = reservationReadModel.get(subscribedHistory)?.items;
      expect(updatedItems?.[0]?.feedback).toMatchObject({
        meetingHappened: true,
        rating: {
          rating: 9,
          content: '非常實用！',
          isPublic: true,
        },
        nextStep: null,
      });
      expect(updatedItems?.[1]).toEqual(untouched);
    } finally {
      unsubscribe();
    }
  });

  it('throws error and skips API call when myUserId is missing', async () => {
    const reservation = makeMockReservation({ id: 'res-730-no-user' });

    await expect(
      submitReservationFeedback({
        reservation,
        myUserId: '',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 10, content: '' },
        },
      })
    ).rejects.toThrow('[reservationMutations] missing current user id');

    expect(mockPost).not.toHaveBeenCalled();
    expect(clearPoolSpy).not.toHaveBeenCalled();
  });

  it('throws ReservationVersionConflictError, skips Sentry capture, and invalidates HISTORY slices on 409', async () => {
    const reservation = makeMockReservation({
      id: 'res-730-conflict',
      senderUserId: '10',
      participantUserId: '20',
    });
    mockPost.mockRejectedValueOnce(new ApiError(409, 'already submitted'));

    const unscopedHistory = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    const scopedHistory = {
      userId: '10',
      state: 'MENTEE_HISTORY',
      endOfMonthUnix: 1706745599,
    } as const;
    reservationReadModel.set(unscopedHistory, emptyPage);
    reservationReadModel.set(scopedHistory, emptyPage);

    await expect(
      submitReservationFeedback({
        reservation,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 10, content: '重複送出' },
        },
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(mockCaptureFailure).not.toHaveBeenCalled();
    expect(reservationReadModel.get(unscopedHistory)).toBeUndefined();
    expect(reservationReadModel.get(scopedHistory)).toBeUndefined();
    expect(clearPoolSpy).not.toHaveBeenCalled();
  });

  it('posts meeting_happened=false with not_happened_reason and reports Sentry failure when API throws', async () => {
    const reservation = makeMockReservation({ id: 'res-731' });
    mockPost.mockRejectedValueOnce(new Error('Feedback submit failed'));

    await expect(
      submitReservationFeedback({
        reservation,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          meeting_happened: false,
          not_happened_reason: 'SCHEDULE_CONFLICT',
        },
      })
    ).rejects.toThrow('Feedback submit failed');

    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_feedback_submit',
      step: 'post_feedback',
      message: 'Feedback submit failed',
    });
    expect(clearPoolSpy).not.toHaveBeenCalled();
  });
});

describe('updateReservationFeedback (#731)', () => {
  let clearPoolSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(new Promise(() => {}));
    reservationReadModel.clear();
    clearPoolSpy = vi
      .spyOn(mentorPoolReadManager, 'clear')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clearPoolSpy.mockRestore();
  });

  it('calls PUT /feedback with { rating, content }, preserves createdAt, isPublic=true, and item order, and clears mentor pool + history caches', async () => {
    mockPut.mockResolvedValueOnce({});

    const targetRes = makeMockReservation({
      id: 'res-edit-1',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 7,
          content: '原本的評論',
          createdAt: 1700001000,
          updatedAt: 1700001000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    const otherRes = makeMockReservation({
      id: 'res-other',
      senderUserId: '10',
      participantUserId: '30',
    });

    const menteeHistoryKey = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    const mentorHistoryKey = {
      userId: '20',
      state: 'MENTOR_HISTORY',
    } as const;

    reservationReadModel.set(menteeHistoryKey, {
      items: [otherRes, targetRes],
      next_dtend: 0,
    });
    reservationReadModel.set(mentorHistoryKey, emptyPage);

    const invalidatedMentorIds: Array<number | undefined> = [];
    const unsubscribeFeedback = subscribeMentorFeedbackInvalidation(
      (mentorId) => {
        invalidatedMentorIds.push(mentorId);
      }
    );
    const unsubscribe = reservationReadModel.subscribe(
      menteeHistoryKey,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await updateReservationFeedback({
        reservation: targetRes,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          rating: 9,
          content: '修改後的評論內容',
        },
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/v1/users/10/reservations/res-edit-1/feedback',
        {
          rating: 9,
          content: '修改後的評論內容',
        }
      );

      const optimisticPage = reservationReadModel.get(menteeHistoryKey);
      expect(optimisticPage).toBeDefined();
      expect(optimisticPage?.items.map((item) => item.id)).toEqual([
        'res-other',
        'res-edit-1',
      ]);
      expect(optimisticPage?.items[1]?.feedback).toEqual({
        meetingHappened: true,
        rating: {
          rating: 9,
          content: '修改後的評論內容',
          createdAt: 1700001000,
          updatedAt: expect.any(Number),
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/v1/users/10/reservations',
        expect.objectContaining({
          params: expect.objectContaining({ state: 'MENTEE_HISTORY' }),
        })
      );
      expect(reservationReadModel.get(mentorHistoryKey)).toBeUndefined();
      expect(clearPoolSpy).toHaveBeenCalledTimes(1);
      expect(invalidatedMentorIds).toEqual([20]);
    } finally {
      unsubscribe();
      unsubscribeFeedback();
    }
  });

  it('preserves isPublic=false and meetingHappened=false when editing an unpublicized feedback item', async () => {
    mockPut.mockResolvedValueOnce({});

    const unpublicizedRes = makeMockReservation({
      id: 'res-unpub',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: false,
        rating: {
          rating: 8,
          content: '未公開的舊評論',
          createdAt: 1700002000,
          updatedAt: 1700002000,
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      },
    });

    const menteeHistoryKey = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    reservationReadModel.set(menteeHistoryKey, {
      items: [unpublicizedRes],
      next_dtend: 0,
    });

    const unsubscribe = reservationReadModel.subscribe(
      menteeHistoryKey,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await updateReservationFeedback({
        reservation: unpublicizedRes,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          rating: 6,
          content: '未公開評論修改版',
        },
      });

      const updatedFeedback =
        reservationReadModel.get(menteeHistoryKey)?.items[0]?.feedback;
      expect(updatedFeedback).toEqual({
        meetingHappened: false,
        rating: {
          rating: 6,
          content: '未公開評論修改版',
          createdAt: 1700002000,
          updatedAt: expect.any(Number),
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      });
      expect(clearPoolSpy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('throws error and skips API call when myUserId is missing', async () => {
    const reservation = makeMockReservation({ id: 'res-edit-no-user' });

    await expect(
      updateReservationFeedback({
        reservation,
        myUserId: '',
        myRole: 'mentee',
        payload: { rating: 8, content: '缺少使用者' },
      })
    ).rejects.toThrow('[reservationMutations] missing current user id');

    expect(mockPut).not.toHaveBeenCalled();
    expect(clearPoolSpy).not.toHaveBeenCalled();
  });

  it('invalidates history keys on 409 conflict and captures Sentry flow failure on generic error', async () => {
    const reservation = makeMockReservation({ id: 'res-edit-err' });
    mockPut.mockRejectedValueOnce(new ApiError(409, 'Conflict', '409'));

    const menteeHistoryKey = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    reservationReadModel.set(menteeHistoryKey, emptyPage);

    await expect(
      updateReservationFeedback({
        reservation,
        myUserId: '10',
        myRole: 'mentee',
        payload: { rating: 8, content: '衝突測試' },
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(reservationReadModel.get(menteeHistoryKey)).toBeUndefined();
    expect(mockCaptureFailure).not.toHaveBeenCalled();

    mockPut.mockRejectedValueOnce(new Error('Update feedback failed'));

    await expect(
      updateReservationFeedback({
        reservation,
        myUserId: '10',
        myRole: 'mentee',
        payload: { rating: 8, content: '失敗測試' },
      })
    ).rejects.toThrow('Update feedback failed');

    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_feedback_edit',
      step: 'put_feedback',
      message: 'Update feedback failed',
    });
  });

  it('supports Mentor Option A { meeting_happened: true } without payload.feedback and { meeting_happened: false } unpublishing (#740)', async () => {
    const clearPoolSpy = vi.spyOn(mentorPoolReadManager, 'clear');
    const feedbackInvalidatedIds: Array<number | undefined> = [];
    const unsubscribeFeedback = subscribeMentorFeedbackInvalidation((id) => {
      feedbackInvalidatedIds.push(id);
    });

    const mentorRes = makeMockReservation({
      id: 'res-mentor-740',
      senderUserId: 99,
      participantUserId: 20,
      viewerRole: 'MENTOR',
      feedback: {
        meetingHappened: null,
        rating: {
          rating: 9,
          content: '導師建議很具體',
          createdAt: 1700001000,
          updatedAt: 1700001000,
          authorName: '林＊華',
          isPublic: true,
        },
        nextStep: 'ANSWER',
      },
    });

    const mentorHistoryKey = {
      userId: '20',
      state: 'MENTOR_HISTORY',
    } as const;
    reservationReadModel.set(mentorHistoryKey, {
      items: [mentorRes],
      next_dtend: 0,
    });
    const unsubHistory = reservationReadModel.subscribe(
      mentorHistoryKey,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      mockPost.mockResolvedValueOnce({ code: '0', msg: 'ok', data: {} });

      await submitReservationFeedback({
        reservation: mentorRes,
        myUserId: '20',
        myRole: 'mentor',
        payload: { meeting_happened: true },
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/users/20/reservations/res-mentor-740/feedback',
        { meeting_happened: true }
      );
      expect(clearPoolSpy).toHaveBeenCalledTimes(1);
      expect(feedbackInvalidatedIds).toContain(20);

      mockPost.mockResolvedValueOnce({ code: '0', msg: 'ok', data: {} });
      reservationReadModel.set(mentorHistoryKey, {
        items: [mentorRes],
        next_dtend: 0,
      });

      await submitReservationFeedback({
        reservation: mentorRes,
        myUserId: '20',
        myRole: 'mentor',
        payload: {
          meeting_happened: false,
          not_happened_reason: 'MENTOR_ABSENT',
        },
      });

      const afterNotHappened =
        reservationReadModel.get(mentorHistoryKey)?.items[0]?.feedback;
      expect(afterNotHappened).toEqual({
        meetingHappened: false,
        rating: {
          rating: 9,
          content: '導師建議很具體',
          createdAt: 1700001000,
          updatedAt: 1700001000,
          authorName: '林＊華',
          isPublic: false,
        },
        nextStep: null,
      });
      expect(clearPoolSpy).toHaveBeenCalledTimes(2);
    } finally {
      unsubHistory();
      unsubscribeFeedback();
      clearPoolSpy.mockRestore();
    }
  });
});

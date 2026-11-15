import { fromPartial } from '@total-typescript/shoehorn';
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
import {
  getUserProfileDtoFromCache,
  primeUserProfileDtoCache,
  userProfileDtoReadManager,
} from '@/lib/cache/userProfileDtoCache';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import {
  mentorPoolReadModel,
  UNFILTERED_MENTOR_POOL_QUERY,
} from '@/lib/mentor/mentorPoolReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import { getSessionPendingFeedbackState } from '@/lib/reservation/pendingFeedbackGuard';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import {
  acceptReservation,
  getReservationErrorMessage,
  rejectOrCancelReservation,
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
  submitReservationFeedback,
  updateReservationFeedback,
} from '@/services/reservations';
import type { MentorFeedbackPage } from '@/types/feedback';
import type { MentorType } from '@/types/mentor';
import type { Reservation } from '@/types/reservation';
import type { MentorProfileVO } from '@/types/user';

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
    window.sessionStorage.clear();
    reservationReadModel.clear();
    mentorPoolReadModel.clear();
    mentorFeedbackReadModel.clear();
    userProfileDtoReadManager.clear();
    clearPoolSpy = vi.spyOn(mentorPoolReadModel, 'clear');
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
        not_happened_reason: 'COUNTERPART_ABSENT',
      },
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/v1/users/10/reservations/res-730-absent/feedback',
      {
        meeting_happened: false,
        not_happened_reason: 'COUNTERPART_ABSENT',
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

  it('forces optimistic rating.isPublic=false and meetingHappened=false when Mentor already answered not-happened before Mentee submits happened + rating (#740)', async () => {
    const peerDisagreedRes = makeMockReservation({
      id: 'res-740-peer-false',
      senderUserId: '10',
      participantUserId: '20',
      feedback: {
        meetingHappened: false,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    mockPost.mockResolvedValueOnce({ ok: true });

    const subscribedHistory = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    reservationReadModel.set(subscribedHistory, {
      items: [peerDisagreedRes],
      next_dtend: 0,
    });
    const unsubscribe = reservationReadModel.subscribe(
      subscribedHistory,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await submitReservationFeedback({
        reservation: peerDisagreedRes,
        myUserId: '10',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 10, content: '我覺得有收穫' },
        },
      });

      const updatedFeedback =
        reservationReadModel.get(subscribedHistory)?.items[0]?.feedback;
      expect(updatedFeedback).toMatchObject({
        meetingHappened: false,
        rating: {
          rating: 10,
          content: '我覺得有收穫',
          isPublic: false,
        },
        nextStep: null,
      });
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

    // Feedback business 409s (#760 §0) invalidate history slices and rethrow ApiError (not ReservationVersionConflictError)
    for (const businessType of [
      'attendance_already_reported',
      'attendance_not_allowed',
      'mentor_unavailable',
    ]) {
      reservationReadModel.set(unscopedHistory, emptyPage);
      mockPost.mockRejectedValueOnce(
        new ApiError(409, 'Feedback conflict', '409', {
          type: businessType,
          message: `Business conflict: ${businessType}`,
        })
      );

      let caught: unknown;
      try {
        await submitReservationFeedback({
          reservation,
          myUserId: '10',
          myRole: 'mentee',
          payload: {
            meeting_happened: true,
            feedback: { rating: 10, content: '測試' },
          },
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect(caught).not.toBeInstanceOf(ReservationVersionConflictError);
      expect(caught).toMatchObject({
        status: 409,
        data: { type: businessType },
      });
      expect(reservationReadModel.get(unscopedHistory)).toBeUndefined();
    }
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
  let invalidateFeedbackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockGet.mockReturnValue(new Promise(() => {}));
    reservationReadModel.clear();
    mentorPoolReadModel.clear();
    mentorFeedbackReadModel.clear();
    userProfileDtoReadManager.clear();
    clearPoolSpy = vi
      .spyOn(mentorPoolReadModel, 'clear')
      .mockImplementation(() => {});
    invalidateFeedbackSpy = vi.spyOn(
      mentorFeedbackReadModel,
      'invalidateMentor'
    );
  });

  afterEach(() => {
    clearPoolSpy.mockRestore();
    invalidateFeedbackSpy.mockRestore();
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
      expect(invalidateFeedbackSpy).toHaveBeenCalledWith(20);
    } finally {
      unsubscribe();
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

    for (const businessType of [
      'attendance_already_reported',
      'attendance_not_allowed',
      'mentor_unavailable',
    ]) {
      reservationReadModel.set(menteeHistoryKey, emptyPage);
      mockPut.mockRejectedValueOnce(
        new ApiError(409, `Business conflict: ${businessType}`, '409', {
          type: businessType,
          message: `Business conflict: ${businessType}`,
        })
      );

      let caughtEditErr: unknown;
      try {
        await updateReservationFeedback({
          reservation,
          myUserId: '10',
          myRole: 'mentee',
          payload: { rating: 8, content: '業務衝突測試' },
        });
      } catch (err) {
        caughtEditErr = err;
      }

      expect(caughtEditErr).toBeInstanceOf(ApiError);
      expect(caughtEditErr).not.toBeInstanceOf(ReservationVersionConflictError);
      expect(caughtEditErr).toMatchObject({
        status: 409,
        data: { type: businessType },
      });
      expect(reservationReadModel.get(menteeHistoryKey)).toBeUndefined();
    }

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
    const localClearPoolSpy = vi.spyOn(mentorPoolReadModel, 'clear');
    const localInvalidateFeedbackSpy = vi.spyOn(
      mentorFeedbackReadModel,
      'invalidateMentor'
    );

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
      expect(localClearPoolSpy).toHaveBeenCalledTimes(1);
      expect(localInvalidateFeedbackSpy).toHaveBeenCalledWith(20);

      const afterHappened =
        reservationReadModel.get(mentorHistoryKey)?.items[0]?.feedback;
      expect(afterHappened).toMatchObject({
        meetingHappened: true,
        myMeetingHappened: true,
        nextStep: null,
      });

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
          not_happened_reason: 'COUNTERPART_ABSENT',
        },
      });

      const afterNotHappened =
        reservationReadModel.get(mentorHistoryKey)?.items[0]?.feedback;
      expect(afterNotHappened).toEqual({
        meetingHappened: false,
        myMeetingHappened: false,
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
      expect(localClearPoolSpy).toHaveBeenCalledTimes(2);
    } finally {
      unsubHistory();
      localClearPoolSpy.mockRestore();
      localInvalidateFeedbackSpy.mockRestore();
    }
  });
});

describe('5-store atomic invalidation & in-memory transport adapter (#888)', () => {
  const TARGET_MENTOR_ID = 20;
  const OTHER_MENTOR_ID = 99;

  function seedAllFiveStores(reservation: Reservation): void {
    reservationReadModel.set(
      { userId: '10', state: 'MENTEE_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );
    reservationReadModel.set(
      { userId: String(TARGET_MENTOR_ID), state: 'MENTOR_HISTORY' },
      { items: [reservation], next_dtend: 0 }
    );

    mentorPoolReadModel.set(UNFILTERED_MENTOR_POOL_QUERY, {
      mentors: [fromPartial<MentorType>({ user_id: TARGET_MENTOR_ID })],
      nextCursor: null,
      hasMore: false,
      mentorCount: 1,
      isNoResults: false,
      hasError: false,
    });

    const sampleFeedbackPage: MentorFeedbackPage = {
      items: [
        {
          id: 'fb-seed',
          authorName: '王**',
          rating: 8,
          content: '初始評價',
          createdAt: '2026-10-20T10:00:00Z',
        },
      ],
      totalRatingCount: 1,
      page: 1,
      pageSize: 10,
      ratingAverage: 8.0,
      completedMeetingCount: 5,
    };
    mentorFeedbackReadModel.set(
      { mentorId: TARGET_MENTOR_ID, page: 1 },
      sampleFeedbackPage
    );
    mentorFeedbackReadModel.set(
      { mentorId: OTHER_MENTOR_ID, page: 1 },
      sampleFeedbackPage
    );

    primeUserProfileDtoCache(
      TARGET_MENTOR_ID,
      'zh_TW',
      fromPartial<MentorProfileVO>({ user_id: TARGET_MENTOR_ID })
    );
    primeUserProfileDtoCache(
      TARGET_MENTOR_ID,
      'en_US',
      fromPartial<MentorProfileVO>({ user_id: TARGET_MENTOR_ID })
    );
    primeUserProfileDtoCache(
      OTHER_MENTOR_ID,
      'zh_TW',
      fromPartial<MentorProfileVO>({ user_id: OTHER_MENTOR_ID })
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    reservationReadModel.clear();
    mentorPoolReadModel.clear();
    mentorFeedbackReadModel.clear();
    userProfileDtoReadManager.clear();
  });

  it('atomically updates/invalidates all 5 stores on submit via injected in-memory transport without touching HTTP apiClient', async () => {
    const reservation = makeMockReservation({
      id: 'res-888-submit',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: null,
        myMeetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    seedAllFiveStores(reservation);

    const submittedPayloads: unknown[] = [];
    await submitReservationFeedback({
      reservation,
      myUserId: '10',
      myRole: 'mentee',
      payload: {
        meeting_happened: true,
        feedback: { rating: 10, content: '使用記憶體 transport 測試送出' },
      },
      transport: {
        submitFeedback: async (opts) => {
          submittedPayloads.push(opts);
          return { ok: true };
        },
      },
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(submittedPayloads).toEqual([
      {
        userId: '10',
        reservationId: 'res-888-submit',
        body: {
          meeting_happened: true,
          feedback: { rating: 10, content: '使用記憶體 transport 測試送出' },
        },
      },
    ]);

    // 1. reservationReadModel invalidated for both parties
    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTEE_HISTORY' })
    ).toBeUndefined();
    expect(
      reservationReadModel.get({
        userId: String(TARGET_MENTOR_ID),
        state: 'MENTOR_HISTORY',
      })
    ).toBeUndefined();

    // 2. mentorPoolReadModel cleared
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();

    // 3. mentorFeedbackReadModel invalidated for target mentor only
    expect(
      mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
    ).toBeUndefined();
    expect(
      mentorFeedbackReadModel.get({ mentorId: OTHER_MENTOR_ID, page: 1 })
    ).toBeDefined();

    // 4. userProfileDtoCache invalidated for both zh_TW and en_US of target mentor
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();
    expect(getUserProfileDtoFromCache(OTHER_MENTOR_ID, 'zh_TW')).not.toBeNull();

    // 5. pendingFeedbackGuard marked submitted
    expect(getSessionPendingFeedbackState('10').submittedIds).toContain(
      'res-888-submit'
    );
  });

  it('preserves myMeetingHappened during #731 edits (both public and mutual-non-denial unpublicized) and invalidates all 5 stores on public edit', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const publicRes = makeMockReservation({
      id: 'res-888-edit-public',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: true,
        myMeetingHappened: true,
        rating: {
          rating: 8,
          content: '原本公開評論',
          createdAt: 1700001000,
          updatedAt: 1700001000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    seedAllFiveStores(publicRes);

    const menteeHistoryKey = {
      userId: '10',
      state: 'MENTEE_HISTORY',
    } as const;
    const unsubPublic = reservationReadModel.subscribe(
      menteeHistoryKey,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await updateReservationFeedback({
        reservation: publicRes,
        myUserId: '10',
        myRole: 'mentee',
        payload: { rating: 10, content: '編輯後的公開評論' },
        transport: {
          updateFeedback: async () => ({}),
        },
      });

      expect(mockPut).not.toHaveBeenCalled();
      expect(
        reservationReadModel.get(menteeHistoryKey)?.items[0]?.feedback
      ).toEqual({
        meetingHappened: true,
        myMeetingHappened: true,
        rating: {
          rating: 10,
          content: '編輯後的公開評論',
          createdAt: 1700001000,
          updatedAt: expect.any(Number),
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      });

      expect(
        reservationReadModel.get({
          userId: String(TARGET_MENTOR_ID),
          state: 'MENTOR_HISTORY',
        })
      ).toBeUndefined();
      expect(
        mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
      ).toBeUndefined();
      expect(
        mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
      ).toBeUndefined();
      expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
      expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();
      expect(getSessionPendingFeedbackState('10').submittedIds).toContain(
        'res-888-edit-public'
      );
    } finally {
      unsubPublic();
    }

    // Mutual non-denial case: Mentee answered myMeetingHappened=true, Mentor reported COUNTERPART_ABSENT -> meetingHappened=false, isPublic=false
    const unpublicizedByPeerRes = makeMockReservation({
      id: 'res-888-edit-peer-absent',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: false,
        myMeetingHappened: true,
        rating: {
          rating: 8,
          content: '導師標記未出席前的評論',
          createdAt: 1700002000,
          updatedAt: 1700002000,
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      },
    });
    reservationReadModel.set(menteeHistoryKey, {
      items: [unpublicizedByPeerRes],
      next_dtend: 0,
    });
    const unsubPeerAbsent = reservationReadModel.subscribe(
      menteeHistoryKey,
      () => new Promise(() => {}),
      () => {}
    );

    try {
      await updateReservationFeedback({
        reservation: unpublicizedByPeerRes,
        myUserId: '10',
        myRole: 'mentee',
        payload: { rating: 7, content: '保留個人已出席狀態但仍維持不公開' },
        transport: {
          updateFeedback: async () => ({}),
        },
      });

      expect(
        reservationReadModel.get(menteeHistoryKey)?.items[0]?.feedback
      ).toEqual({
        meetingHappened: false,
        myMeetingHappened: true,
        rating: {
          rating: 7,
          content: '保留個人已出席狀態但仍維持不公開',
          createdAt: 1700002000,
          updatedAt: expect.any(Number),
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      });
    } finally {
      unsubPeerAbsent();
    }
  });

  it('atomically invalidates all 5 stores on COUNTERPART_ABSENT when Mentor reports absent or when Mentee reports absent after Mentor confirmed happened', async () => {
    // Scenario 1: Mentor reports COUNTERPART_ABSENT
    const mentorAbsentRes = makeMockReservation({
      id: 'res-888-mentor-absent',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      viewerRole: 'MENTOR',
      feedback: {
        meetingHappened: true,
        myMeetingHappened: null,
        rating: {
          rating: 9,
          content: '學員先行送出的評論',
          createdAt: 1700003000,
          updatedAt: 1700003000,
          authorName: '陳**',
          isPublic: true,
        },
        nextStep: 'ANSWER',
      },
    });
    seedAllFiveStores(mentorAbsentRes);

    await submitReservationFeedback({
      reservation: mentorAbsentRes,
      myUserId: String(TARGET_MENTOR_ID),
      myRole: 'mentor',
      payload: {
        meeting_happened: false,
        not_happened_reason: 'COUNTERPART_ABSENT',
      },
      transport: {
        submitFeedback: async () => ({}),
      },
    });

    expect(
      reservationReadModel.get({
        userId: String(TARGET_MENTOR_ID),
        state: 'MENTOR_HISTORY',
      })
    ).toBeUndefined();
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(
      mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
    ).toBeUndefined();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();
    expect(
      getSessionPendingFeedbackState(String(TARGET_MENTOR_ID)).submittedIds
    ).toContain('res-888-mentor-absent');

    // Scenario 2: Mentee reports COUNTERPART_ABSENT after Mentor had already confirmed meetingHappened=true
    const menteeAbsentAfterMentorHappened = makeMockReservation({
      id: 'res-888-mentee-absent-override',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      viewerRole: 'MENTEE',
      feedback: {
        meetingHappened: true,
        myMeetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    seedAllFiveStores(menteeAbsentAfterMentorHappened);

    await submitReservationFeedback({
      reservation: menteeAbsentAfterMentorHappened,
      myUserId: '10',
      myRole: 'mentee',
      payload: {
        meeting_happened: false,
        not_happened_reason: 'COUNTERPART_ABSENT',
      },
      transport: {
        submitFeedback: async () => ({}),
      },
    });

    expect(
      reservationReadModel.get({ userId: '10', state: 'MENTEE_HISTORY' })
    ).toBeUndefined();
    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(
      mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
    ).toBeUndefined();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();
    expect(getSessionPendingFeedbackState('10').submittedIds).toContain(
      'res-888-mentee-absent-override'
    );
  });

  it('invalidates all 5 stores on #731 edit even when pre-write reservation prop has stale isPublic=false or when backend transitions a public review to unpublicized', async () => {
    const stalePropRes = makeMockReservation({
      id: 'res-888-stale-prop',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: false,
        myMeetingHappened: true,
        rating: {
          rating: 7,
          content: '對話框開啟時的舊快照',
          createdAt: 1700004000,
          updatedAt: 1700004000,
          authorName: '王＊明',
          isPublic: false,
        },
        nextStep: null,
      },
    });
    const liveCachedPublicRes = makeMockReservation({
      id: 'res-888-stale-prop',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: true,
        myMeetingHappened: true,
        rating: {
          rating: 7,
          content: '快取中已公開的最新狀態',
          createdAt: 1700004000,
          updatedAt: 1700004000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    seedAllFiveStores(liveCachedPublicRes);

    await updateReservationFeedback({
      reservation: stalePropRes,
      myUserId: '10',
      myRole: 'mentee',
      payload: { rating: 10, content: '即使舊 prop 為 false 仍應刷新公開快取' },
      transport: {
        updateFeedback: async () => ({}),
      },
    });

    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(
      mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
    ).toBeUndefined();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();

    // Reverse transition: review was public on input, backend response marks is_public=false
    const previouslyPublicRes = makeMockReservation({
      id: 'res-888-became-private',
      senderUserId: '10',
      participantUserId: String(TARGET_MENTOR_ID),
      feedback: {
        meetingHappened: true,
        myMeetingHappened: true,
        rating: {
          rating: 9,
          content: '原本公開但後端剛轉為不公開',
          createdAt: 1700005000,
          updatedAt: 1700005000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });
    seedAllFiveStores(previouslyPublicRes);

    await updateReservationFeedback({
      reservation: previouslyPublicRes,
      myUserId: '10',
      myRole: 'mentee',
      payload: {
        rating: 8,
        content: '後端回應轉為不公開時也必須清除舊公開快取',
      },
      transport: {
        updateFeedback: async () => ({
          feedback: {
            meeting_happened: false,
            rating: { is_public: false },
          },
        }),
      },
    });

    expect(
      mentorPoolReadModel.get(UNFILTERED_MENTOR_POOL_QUERY)
    ).toBeUndefined();
    expect(
      mentorFeedbackReadModel.get({ mentorId: TARGET_MENTOR_ID, page: 1 })
    ).toBeUndefined();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'zh_TW')).toBeNull();
    expect(getUserProfileDtoFromCache(TARGET_MENTOR_ID, 'en_US')).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/lib/apiClient', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      putUnwrapped: vi.fn(),
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
import { captureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import {
  acceptReservation,
  getReservationErrorMessage,
  rejectOrCancelReservation,
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

const mockPut = vi.mocked(apiClient.putUnwrapped);
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

  it('should throw ReservationVersionConflictError and skip Sentry capture on 409', async () => {
    const reservation = makeMockReservation({ version: 3 });
    mockPut.mockRejectedValue(new ApiError(409, 'version conflict'));

    await expect(
      acceptReservation({
        message: 'hello',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(mockCaptureFailure).not.toHaveBeenCalled();
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

  it('should throw ReservationVersionConflictError and skip Sentry capture on 409', async () => {
    const reservation = makeMockReservation({ version: 3 });
    mockPut.mockRejectedValue(new ApiError(409, 'version conflict'));

    await expect(
      rejectOrCancelReservation({
        text: 'reason',
        reservation,
        myUserId: '10',
        myRole: 'mentor',
      })
    ).rejects.toBeInstanceOf(ReservationVersionConflictError);

    expect(mockCaptureFailure).not.toHaveBeenCalled();
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

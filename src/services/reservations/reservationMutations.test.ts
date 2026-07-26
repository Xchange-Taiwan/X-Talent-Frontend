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
      put: vi.fn(),
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

import type { Reservation } from '@/components/reservation/types';
import { trackEvent } from '@/lib/analytics';
import { apiClient } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  acceptReservation,
  buildRejectOrCancelAffectedTabs,
  rejectOrCancelReservation,
  resolveOtherId,
} from '@/services/reservations';

const mockPut = vi.mocked(apiClient.put);
const mockTrackEvent = vi.mocked(trackEvent);
const mockCaptureFailure = vi.mocked(captureFlowFailure);

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
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveOtherId', () => {
  it('should resolve to participantUserId if current user is the sender', () => {
    const res = makeMockReservation({
      senderUserId: 'user-sender',
      participantUserId: 'user-participant',
    });
    const result = resolveOtherId(res, 'user-sender');
    expect(result).toBe('user-participant');
  });

  it('should resolve to senderUserId if current user is the participant', () => {
    const res = makeMockReservation({
      senderUserId: 'user-sender',
      participantUserId: 'user-participant',
    });
    const result = resolveOtherId(res, 'user-participant');
    expect(result).toBe('user-sender');
  });
});

describe('buildRejectOrCancelAffectedTabs', () => {
  it('should return upcoming and history for upcoming variant', () => {
    expect(buildRejectOrCancelAffectedTabs('upcoming')).toEqual([
      'upcoming',
      'history',
    ]);
  });

  it('should return pending and history for pending-mentor variant', () => {
    expect(buildRejectOrCancelAffectedTabs('pending-mentor')).toEqual([
      'pending',
      'history',
    ]);
  });

  it('should return pending and history for pending-mentee variant', () => {
    expect(buildRejectOrCancelAffectedTabs('pending-mentee')).toEqual([
      'pending',
      'history',
    ]);
  });

  it('should return empty list for history or unknown variant', () => {
    expect(buildRejectOrCancelAffectedTabs('history')).toEqual([]);
  });
});

describe('acceptReservation', () => {
  it('should call updateReservationStatus with ACCEPT status and return pending and upcoming tabs', async () => {
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

    const result = await acceptReservation({
      id: 'res-123',
      message: 'Looking forward to meeting you!',
      reservation,
      myUserId: '10',
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
    });

    expect(result).toEqual({ affectedTabs: ['pending', 'upcoming'] });
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
      id: 'res-123',
      message: '  ',
      reservation,
      myUserId: '10',
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
        id: 'res-123',
        message: 'hello',
        reservation,
        myUserId: '10',
      })
    ).rejects.toThrow('API failed');

    expect(mockCaptureFailure).toHaveBeenCalledTimes(1);
    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_accept',
      step: 'update_status',
      message: 'API failed',
    });
  });
});

describe('rejectOrCancelReservation', () => {
  it('should call updateReservationStatus with REJECT status and track rejection event', async () => {
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

    const result = await rejectOrCancelReservation({
      id: 'res-123',
      text: 'Sorry, I am busy',
      reservation,
      myUserId: '10',
      variant: 'pending-mentor',
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
    });

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_rejected',
      feature: 'reservation',
    });

    expect(result).toEqual({ affectedTabs: ['pending', 'history'] });
  });

  it('should work correctly for upcoming variant and return correct affected tabs', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });

    mockPut.mockResolvedValue({
      code: '0',
      msg: 'success',
      data: {},
    });

    const result = await rejectOrCancelReservation({
      id: 'res-123',
      text: 'Cancel reason',
      reservation,
      myUserId: '10',
      variant: 'upcoming',
    });

    expect(result).toEqual({ affectedTabs: ['upcoming', 'history'] });
  });

  it('should work correctly for pending-mentee variant', async () => {
    const reservation = makeMockReservation({
      senderUserId: '10',
      participantUserId: '20',
    });

    mockPut.mockResolvedValue({
      code: '0',
      msg: 'success',
      data: {},
    });

    const result = await rejectOrCancelReservation({
      id: 'res-123',
      text: 'Cancel reason',
      reservation,
      myUserId: '10',
      variant: 'pending-mentee',
    });

    expect(result).toEqual({ affectedTabs: ['pending', 'history'] });
  });

  it('should capture failure and rethrow when API fails on rejectOrCancel', async () => {
    const reservation = makeMockReservation();
    const testError = new Error('Reject failed');
    mockPut.mockRejectedValue(testError);

    await expect(
      rejectOrCancelReservation({
        id: 'res-123',
        text: 'reason',
        reservation,
        myUserId: '10',
        variant: 'upcoming',
      })
    ).rejects.toThrow('Reject failed');

    expect(mockCaptureFailure).toHaveBeenCalledTimes(1);
    expect(mockCaptureFailure).toHaveBeenCalledWith({
      flow: 'reservation_reject',
      step: 'update_status',
      message: 'Reject failed',
    });
  });
});

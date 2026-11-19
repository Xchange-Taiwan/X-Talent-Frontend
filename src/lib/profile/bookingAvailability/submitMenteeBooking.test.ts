import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/services/reservations', () => ({
  createReservation: vi.fn(),
}));

import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { createReservation } from '@/services/reservations';
import type { components } from '@/types/api';

import { submitMenteeBooking } from './submitMenteeBooking';
import type { BookingSlot } from './types';

const mockDefaultCreateReservation = vi.mocked(createReservation);
const mockDefaultTrackEvent = vi.mocked(trackEvent);
const mockDefaultCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('submitMenteeBooking', () => {
  const openSlot: BookingSlot = {
    scheduleId: 456,
    start: new Date('2026-07-26T14:00:00Z'),
    end: new Date('2026-07-26T15:00:00Z'),
    isBooked: false,
    status: null,
  };

  const mockReservationVo = {
    id: 777,
  } as unknown as components['schemas']['ReservationVO'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthenticated when menteeUserId is null, undefined, or blank', async () => {
    const createBooking = vi.fn();

    for (const menteeUserId of [null, undefined, '', '   ']) {
      const result = await submitMenteeBooking({
        menteeUserId,
        mentorUserId: 123,
        slot: openSlot,
        question: 'Hello',
        createBooking,
      });

      expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    }

    expect(createBooking).not.toHaveBeenCalled();
    expect(mockDefaultTrackEvent).not.toHaveBeenCalled();
    expect(mockDefaultCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('returns invalid_context when slot is missing, already taken, or user IDs are non-positive', async () => {
    const createBooking = vi.fn();

    expect(
      await submitMenteeBooking({
        menteeUserId: '999',
        mentorUserId: 123,
        slot: null,
        createBooking,
      })
    ).toEqual({ ok: false, reason: 'invalid_context' });

    expect(
      await submitMenteeBooking({
        menteeUserId: '999',
        mentorUserId: 123,
        slot: { ...openSlot, isBooked: true },
        createBooking,
      })
    ).toEqual({ ok: false, reason: 'invalid_context' });

    expect(
      await submitMenteeBooking({
        menteeUserId: '999',
        mentorUserId: 123,
        slot: { ...openSlot, status: 'PENDING' },
        createBooking,
      })
    ).toEqual({ ok: false, reason: 'invalid_context' });

    for (const badMentorId of [null, undefined, '', '0', -5, 'abc']) {
      expect(
        await submitMenteeBooking({
          menteeUserId: '999',
          mentorUserId: badMentorId,
          slot: openSlot,
          createBooking,
        })
      ).toEqual({ ok: false, reason: 'invalid_context' });
    }

    for (const badMenteeId of ['0', '-1', 'not-a-number']) {
      expect(
        await submitMenteeBooking({
          menteeUserId: badMenteeId,
          mentorUserId: 123,
          slot: openSlot,
          createBooking,
        })
      ).toEqual({ ok: false, reason: 'invalid_context' });
    }

    expect(createBooking).not.toHaveBeenCalled();
  });

  it('assembles PENDING ReservationDTO with trimmed question and emits confirmation analytics via injected ports', async () => {
    const createBooking = vi.fn().mockResolvedValue(mockReservationVo);
    const customTrackEvent = vi.fn();
    const customCaptureFlowFailure = vi.fn();

    const result = await submitMenteeBooking({
      menteeUserId: '999',
      mentorUserId: '123',
      slot: openSlot,
      question: '  Hello mentor, please help!  ',
      debug: false,
      ports: {
        createBooking,
        trackEvent: customTrackEvent,
        captureFlowFailure: customCaptureFlowFailure,
      },
    });

    expect(result).toEqual({
      ok: true,
      reservation: mockReservationVo,
    });
    expect(createBooking).toHaveBeenCalledWith({
      userId: 999,
      body: {
        my_user_id: 999,
        my_status: 'PENDING',
        user_id: 123,
        schedule_id: 456,
        dtstart: Math.floor(openSlot.start.getTime() / 1000),
        dtend: Math.floor(openSlot.end.getTime() / 1000),
        messages: [{ user_id: 999, content: 'Hello mentor, please help!' }],
      },
      debug: false,
    });
    expect(customTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_booking_confirmed',
      feature: 'reservation',
      metadata: {
        mentor_id: 123,
      },
    });
    expect(customCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('sends an empty messages array when question is undefined or whitespace-only and uses default ports', async () => {
    mockDefaultCreateReservation.mockResolvedValue(mockReservationVo);

    const result = await submitMenteeBooking({
      menteeUserId: 999,
      mentorUserId: 123,
      slot: openSlot,
      question: '   \n\t  ',
    });

    expect(result).toEqual({
      ok: true,
      reservation: mockReservationVo,
    });
    expect(mockDefaultCreateReservation).toHaveBeenCalledWith({
      userId: 999,
      body: {
        my_user_id: 999,
        my_status: 'PENDING',
        user_id: 123,
        schedule_id: 456,
        dtstart: Math.floor(openSlot.start.getTime() / 1000),
        dtend: Math.floor(openSlot.end.getTime() / 1000),
        messages: [],
      },
      debug: false,
    });
    expect(mockDefaultTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_booking_confirmed',
      feature: 'reservation',
      metadata: {
        mentor_id: 123,
      },
    });
  });

  it('classifies ApiError(409) as slot_conflict, logs info-level flow failure, and never leaks question PII', async () => {
    const conflictError = new ApiError(409, 'Conflict booking');
    const createBooking = vi.fn().mockRejectedValue(conflictError);
    const secretQuestion = 'My private phone is 0912-345-678 and resume link';

    const result = await submitMenteeBooking({
      menteeUserId: '999',
      mentorUserId: 123,
      slot: openSlot,
      question: secretQuestion,
      createBooking,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'slot_conflict',
      message: 'Conflict booking',
    });
    expect(mockDefaultTrackEvent).toHaveBeenCalledWith({
      name: 'booking_submit_failed',
      feature: 'reservation',
      metadata: {
        mentor_id: 123,
        error_type: 'slot_conflict',
      },
    });
    expect(mockDefaultCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'reservation_create',
      step: 'create_reservation',
      message: 'Conflict booking',
      level: 'info',
    });
    expect(
      JSON.stringify(mockDefaultCaptureFlowFailure.mock.calls)
    ).not.toContain(secretQuestion);
    expect(JSON.stringify(mockDefaultTrackEvent.mock.calls)).not.toContain(
      secretQuestion
    );
  });

  it('classifies standard Error and non-Error rejections as api_error without PII leakage', async () => {
    const serverError = new Error('Server Crashed');
    const createBooking = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce('raw failure');
    const secretQuestion = 'Confidential career transition question';

    const firstResult = await submitMenteeBooking({
      menteeUserId: '999',
      mentorUserId: 123,
      slot: openSlot,
      question: secretQuestion,
      createBooking,
    });

    expect(firstResult).toEqual({
      ok: false,
      reason: 'api_error',
      message: 'Server Crashed',
    });
    expect(mockDefaultCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'reservation_create',
      step: 'create_reservation',
      message: 'Server Crashed',
    });
    expect(mockDefaultTrackEvent).toHaveBeenCalledWith({
      name: 'booking_submit_failed',
      feature: 'reservation',
      metadata: {
        mentor_id: 123,
        error_type: 'api_error',
      },
    });

    const secondResult = await submitMenteeBooking({
      menteeUserId: '999',
      mentorUserId: 123,
      slot: openSlot,
      question: secretQuestion,
      createBooking,
    });

    expect(secondResult).toEqual({
      ok: false,
      reason: 'api_error',
      message: 'Unknown error',
    });
    expect(
      JSON.stringify(mockDefaultCaptureFlowFailure.mock.calls)
    ).not.toContain(secretQuestion);
  });
});

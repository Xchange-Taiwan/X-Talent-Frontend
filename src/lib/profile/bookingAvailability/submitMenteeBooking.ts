import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { isSlotTaken } from '@/lib/profile/scheduleHelpers';
import {
  createReservation,
  type CreateReservationParams,
} from '@/services/reservations';
import type { components } from '@/types/api';

import type { BookingSlot } from './types';

export type CreateBookingPort = (
  params: CreateReservationParams
) => Promise<components['schemas']['ReservationVO']>;

export interface SubmitMenteeBookingPorts {
  createBooking?: CreateBookingPort;
  trackEvent?: typeof trackEvent;
  captureFlowFailure?: typeof captureFlowFailure;
}

export interface SubmitMenteeBookingParams {
  menteeUserId: string | number | null | undefined;
  mentorUserId: string | number | null | undefined;
  slot: BookingSlot | null | undefined;
  question?: string;
  debug?: boolean;
  createBooking?: CreateBookingPort;
  ports?: SubmitMenteeBookingPorts;
}

export type SubmitMenteeBookingFailureReason =
  'unauthenticated' | 'invalid_context' | 'slot_conflict' | 'api_error';

export type SubmitMenteeBookingResult =
  | {
      ok: true;
      reservation: components['schemas']['ReservationVO'];
    }
  | {
      ok: false;
      reason: 'unauthenticated';
    }
  | {
      ok: false;
      reason: 'invalid_context';
    }
  | {
      ok: false;
      reason: 'slot_conflict';
      message: string;
    }
  | {
      ok: false;
      reason: 'api_error';
      message: string;
    };

function parsePositiveUserId(
  raw: string | number | null | undefined
): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Pure booking submission workflow (zero React / Next / Hook dependencies).
 *
 * Assembles the `my_status: "PENDING"` ReservationDTO with trimmed optional
 * question, classifies HTTP 409 conflicts vs generic API failures, and emits
 * analytics & Sentry flow monitoring with zero user PII.
 */
export async function submitMenteeBooking(
  params: SubmitMenteeBookingParams
): Promise<SubmitMenteeBookingResult> {
  const {
    menteeUserId,
    mentorUserId,
    slot,
    question,
    debug = process.env.NODE_ENV === 'development',
    ports,
  } = params;

  if (
    menteeUserId === null ||
    menteeUserId === undefined ||
    String(menteeUserId).trim() === ''
  ) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const menteeId = parsePositiveUserId(menteeUserId);
  const mentorId = parsePositiveUserId(mentorUserId);
  if (menteeId === null || mentorId === null || !slot || isSlotTaken(slot)) {
    return { ok: false, reason: 'invalid_context' };
  }

  const runCreateBooking =
    params.createBooking ?? ports?.createBooking ?? createReservation;
  const emitTrackEvent = ports?.trackEvent ?? trackEvent;
  const emitCaptureFlowFailure =
    ports?.captureFlowFailure ?? captureFlowFailure;

  const trimmedQuestion = question?.trim() ?? '';
  const messages = trimmedQuestion
    ? [{ user_id: menteeId, content: trimmedQuestion }]
    : [];

  try {
    const reservation = await runCreateBooking({
      userId: menteeId,
      body: {
        my_user_id: menteeId,
        my_status: 'PENDING',
        user_id: mentorId,
        schedule_id: slot.scheduleId,
        dtstart: Math.floor(slot.start.getTime() / 1000),
        dtend: Math.floor(slot.end.getTime() / 1000),
        messages,
      },
      debug,
    });

    emitTrackEvent({
      name: 'reservation_booking_confirmed',
      feature: 'reservation',
      metadata: {
        mentor_id: mentorId,
      },
    });

    return { ok: true, reservation };
  } catch (error) {
    const isSlotConflict = error instanceof ApiError && error.status === 409;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('Failed to create reservation:', message);

    emitTrackEvent({
      name: 'booking_submit_failed',
      feature: 'reservation',
      metadata: {
        mentor_id: mentorId,
        error_type: isSlotConflict ? 'slot_conflict' : 'api_error',
      },
    });

    emitCaptureFlowFailure({
      flow: 'reservation_create',
      step: 'create_reservation',
      message,
      ...(isSlotConflict ? { level: 'info' as const } : {}),
    });

    return {
      ok: false,
      reason: isSlotConflict ? 'slot_conflict' : 'api_error',
      message,
    };
  }
}

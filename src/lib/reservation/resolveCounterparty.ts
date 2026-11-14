import { TotalWorkSpanEnum } from '@/constant/seniority';
import { resolveCancelledBy } from '@/lib/reservation/reservationLifecyclePolicy';
import type { components } from '@/types/api';
import type { FeedbackViewerRole } from '@/types/reservationFeedback';

export function formatExperience(yearsOfExperience?: string | null) {
  return (
    TotalWorkSpanEnum[yearsOfExperience as keyof typeof TotalWorkSpanEnum] ?? ''
  );
}

export interface CounterpartyResolvable {
  senderUserId: number | string;
  participantUserId: number | string;
}

/**
 * Resolves the counterparty's user ID from a mapped Reservation based on who is currently logged in.
 */
export function resolveCounterpartyId(
  reservation: CounterpartyResolvable,
  myUserId: string | number
): string | number {
  if (!reservation) {
    return '';
  }
  const senderId = reservation.senderUserId;
  if (
    senderId != null &&
    myUserId != null &&
    String(myUserId) === String(senderId)
  ) {
    return reservation.participantUserId;
  }
  return reservation.senderUserId;
}

/**
 * Resolves the positive numeric mentor user ID whose public profile / feedback cache
 * may be affected by a reservation feedback mutation.
 */
export function resolveTargetMentorId(
  reservation: CounterpartyResolvable,
  myUserId: string | number,
  myRole: FeedbackViewerRole
): number | undefined {
  const rawTargetId =
    myRole === 'mentor'
      ? Number(myUserId)
      : Number(resolveCounterpartyId(reservation, myUserId));
  return Number.isFinite(rawTargetId) && rawTargetId > 0
    ? rawTargetId
    : undefined;
}

/**
 * Resolves the viewer's feedback role ('mentor' | 'mentee') for a reservation,
 * preferring the explicit per-reservation `viewerRole` and falling back to
 * session mentor identity when simplified backend items omit `viewer_role`.
 */
export function resolveFeedbackViewerRole(
  viewerRole: 'MENTEE' | 'MENTOR' | null | undefined,
  isMentorFallback = false
): FeedbackViewerRole {
  if (viewerRole === 'MENTOR') {
    return 'mentor';
  }
  if (viewerRole === 'MENTEE') {
    return 'mentee';
  }
  return isMentorFallback ? 'mentor' : 'mentee';
}

/**
 * Ensures a reservation carries an explicit `viewerRole` ('MENTOR' | 'MENTEE'),
 * preserving per-item roles in mixed queues while filling missing roles from
 * `isMentorFallback`.
 */
export function normalizeReservationViewerRole<
  T extends { viewerRole?: 'MENTEE' | 'MENTOR' },
>(reservation: T, isMentorFallback: boolean): T {
  if (
    reservation.viewerRole === 'MENTOR' ||
    reservation.viewerRole === 'MENTEE'
  ) {
    return reservation;
  }
  return {
    ...reservation,
    viewerRole: isMentorFallback ? 'MENTOR' : 'MENTEE',
  };
}

export type ReservationInfoVOWithCancelledBy =
  components['schemas']['ReservationInfoVO'] & {
    cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
  };

/**
 * Resolves the counterparty details (profile fields) from a raw ReservationInfoVO.
 */
export function resolveCounterpartyProfile(
  reservation: ReservationInfoVOWithCancelledBy,
  myUserId?: string | number | null
): {
  name: string;
  avatar?: string;
  roleLine: string;
  cancelledBy?: 'MENTEE' | 'MENTOR' | 'SYSTEM';
  /** Which side `myUserId` occupies for this reservation - undefined when
   * there is no signed-in viewer (myUserId is null/undefined) to resolve a
   * side for. */
  viewerRole?: 'MENTEE' | 'MENTOR';
} {
  if (!reservation) {
    return {
      name: '—',
      avatar: undefined,
      roleLine: '',
      cancelledBy: undefined,
      viewerRole: undefined,
    };
  }

  const counterparty =
    myUserId == null
      ? (reservation.participant ?? reservation.sender)
      : reservation.sender?.user_id != null &&
          String(myUserId) === String(reservation.sender.user_id)
        ? (reservation.participant ?? reservation.sender)
        : (reservation.sender ?? reservation.participant);

  const name = counterparty?.name || '—';
  const avatar = counterparty?.avatar ?? undefined;

  const roleLine = [
    counterparty?.job_title?.trim() || '',
    formatExperience(counterparty?.years_of_experience),
  ]
    .filter(Boolean)
    .join(', ');

  const toRole = (r?: string | null): 'MENTEE' | 'MENTOR' | undefined =>
    r === 'MENTEE' || r === 'MENTOR' ? r : undefined;

  const currentUserSide =
    counterparty === reservation.participant
      ? reservation.sender
      : reservation.participant;

  const cancelledBy = resolveCancelledBy({
    explicitCancelledBy: reservation.cancelled_by,
    counterpartyRole: counterparty?.role,
    counterpartyStatus: counterparty?.status,
    currentUserRole: currentUserSide?.role,
    currentUserStatus: currentUserSide?.status,
  });

  // The viewer's own side is only meaningful when someone is actually
  // signed in - with no myUserId, `counterparty` was picked arbitrarily
  // above (participant-first fallback), so `currentUserSide` wouldn't
  // represent a real viewer.
  const viewerRole =
    myUserId == null ? undefined : toRole(currentUserSide?.role);

  return {
    name,
    avatar,
    roleLine,
    cancelledBy,
    viewerRole,
  };
}

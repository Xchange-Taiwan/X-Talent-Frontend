import { TotalWorkSpanEnum } from '@/constant/seniority';
import type { components } from '@/types/api';

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
 * Resolves the counterparty details (profile fields) from a raw ReservationInfoVO.
 */
export function resolveCounterpartyProfile(
  reservation: components['schemas']['ReservationInfoVO'],
  myUserId?: string | number | null
): {
  name: string;
  avatar?: string;
  roleLine: string;
  cancelledBy?: 'MENTEE' | 'MENTOR';
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

  const cancelledBy =
    counterparty?.status === 'REJECT'
      ? toRole(counterparty?.role)
      : currentUserSide?.status === 'REJECT'
        ? toRole(currentUserSide?.role)
        : undefined;

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

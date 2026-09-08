import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import type { Reservation } from '@/types/reservation';

/**
 * Which side the current viewer is on for a reservation. Lowercase to match
 * this codebase's existing `sourceRole` / `myRole` convention (as opposed to
 * the uppercase `'MENTEE' | 'MENTOR'` used on the wire and on
 * `Reservation.viewerRole` / `Reservation.cancelledBy`).
 */
export type ReservationViewerRole = 'mentor' | 'mentee';

const CANCELLED_BY_LABEL: Record<'MENTEE' | 'MENTOR', string> = {
  MENTOR: '已由導師取消',
  MENTEE: '已由學員取消',
};

export interface ReservationViewerModel {
  /**
   * Which side the current viewer is on, derived from the reservation's own
   * sender/participant role data (`Reservation.viewerRole`) - never a value
   * a caller hardcodes. Undefined only when the reservation carries no role
   * data for the viewer's side (e.g. no signed-in viewer, or a legacy/mocked
   * `Reservation` that never went through `mapToReservation`).
   */
  viewerRole: ReservationViewerRole | undefined;
  /**
   * Profile URL for the counterparty. Undefined when there is no signed-in
   * viewer (`myUserId` missing), the counterparty couldn't be resolved, or
   * the counterparty would resolve to the viewer themself (self-guard).
   * Click-invalidation for this link (disabled state, modifier-key/new-tab
   * passthrough) is a separate concern - see `useProfileLinkClick` in
   * `src/hooks/reservation/` - since this module must not depend on React
   * or its event types (deep-module boundary: `src/lib/**` takes no UI
   * dependency).
   */
  profileHref: string | undefined;
  /**
   * Localized label describing which side cancelled the reservation, or
   * undefined when it wasn't cancelled.
   */
  cancelledByLabel: string | undefined;
}

export interface ResolveReservationViewerOptions {
  /** Null is accepted so a dialog can call this unconditionally, before its
   * own `if (!reservation) return null;` guard - every field simply comes
   * back undefined/inert when there is no reservation yet. */
  reservation: Reservation | null;
  /** The signed-in viewer's own user id. Absent (undefined/null/empty
   * string) means no signed-in viewer - `profileHref` will always be
   * undefined in that case. */
  myUserId: string | number | undefined | null;
}

function toViewerRole(
  role: 'MENTEE' | 'MENTOR' | undefined
): ReservationViewerRole | undefined {
  if (role === 'MENTOR') return 'mentor';
  if (role === 'MENTEE') return 'mentee';
  return undefined;
}

function resolveProfileHref(
  reservation: Reservation,
  myUserId: string | number | undefined | null
): string | undefined {
  if (myUserId == null || myUserId === '') return undefined;

  const otherId = resolveCounterpartyId(reservation, myUserId);
  // Self-guard: skip when the counterparty couldn't be resolved (falsy id,
  // e.g. the default 0) or would resolve to the viewer themself.
  if (!otherId || String(otherId) === String(myUserId)) return undefined;

  return `/profile/${otherId}`;
}

/**
 * Given a reservation and the current viewer, answers what that viewer sees:
 * which side they're on, the counterparty's profile link (with the
 * self-guard baked in), and the localized cancellation status label. Pure
 * data derivation only - no React, no click handling (see
 * `useProfileLinkClick` in `src/hooks/reservation/` for that).
 *
 * Every reservation surface (ConfirmedReservationDialog, QuickReplyDialog,
 * ReservationList, AcceptReservationDialog) derives these facts through this
 * one module instead of re-deriving them - see X-Tracker #671.
 */
export function resolveReservationViewer({
  reservation,
  myUserId,
}: ResolveReservationViewerOptions): ReservationViewerModel {
  const viewerRole = reservation
    ? toViewerRole(reservation.viewerRole)
    : undefined;
  const profileHref = reservation
    ? resolveProfileHref(reservation, myUserId)
    : undefined;

  const cancelledByLabel = reservation?.cancelledBy
    ? CANCELLED_BY_LABEL[reservation.cancelledBy]
    : undefined;

  return {
    viewerRole,
    profileHref,
    cancelledByLabel,
  };
}

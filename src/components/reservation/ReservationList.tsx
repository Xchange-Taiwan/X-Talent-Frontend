// src/components/reservation/reservationList.tsx
'use client';

import { getSession } from 'next-auth/react';

import AcceptReservationDialog from '@/components/reservation/AcceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/CancelReservationDialog';
import { Card, CardContent } from '@/components/ui/card';
import { updateReservationStatus } from '@/services/reservations';

import { ReservationCard } from './ReservationCard';
import type { Reservation } from './types';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';

// ── Component ───────────────────────────────────────────────────────────────

export function ReservationList({
  items,
  variant,
}: {
  items: Reservation[];
  variant: Variant;
}) {
  const findItem = (id: string): Reservation => {
    const found = items.find((x) => x.id === id);
    if (!found)
      throw new Error(`[ReservationList] item not found for id=${id}`);
    return found;
  };

  // Resolve the other party's user_id based on who is currently logged in
  const resolveOtherId = (myId: string, it: Reservation): string | number =>
    String(it.senderUserId) === myId ? it.participantUserId : it.senderUserId;

  // Hard reload the page to reflect updated reservation state
  const hardReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  // Accept a booking request (mentor side, pending-mentor variant)
  const accept = async ({ id, message }: { id: string; message: string }) => {
    const session = await getSession();
    const myId = String(session?.user?.id ?? '');
    if (!myId) throw new Error('[ReservationList] missing current user id');

    const it = findItem(id);
    const otherId = resolveOtherId(myId, it);

    await updateReservationStatus({
      userId: myId,
      reservationId: id,
      body: {
        my_user_id: myId,
        user_id: otherId,
        my_status: 'ACCEPT',
        schedule_id: it.scheduleId,
        dtstart: it.dtstart,
        dtend: it.dtend,
        messages: message.trim()
          ? [{ user_id: myId, msg: message.trim() }]
          : [],
        previous_reserve: {},
      },
    });

    // TODO: block the accepted time slot so other mentees can't book it.
    // Blocked by backend: PUT /mentors/:id/schedule returns 422 when a BLOCK
    // slot overlaps an existing ALLOW slot. Re-enable once backend supports it,
    // or once GET schedule returns booked_slots so the frontend can filter them.

    hardReload();
  };

  // Shared handler for both reject and cancel (same API call)
  const rejectOrCancel = async (id: string, text: string) => {
    const session = await getSession();
    const myId = String(session?.user?.id ?? '');
    if (!myId) throw new Error('[ReservationList] missing current user id');

    const it = findItem(id);
    const otherId = resolveOtherId(myId, it);

    await updateReservationStatus({
      userId: myId,
      reservationId: id,
      body: {
        my_user_id: myId,
        user_id: otherId,
        my_status: 'REJECT',
        schedule_id: it.scheduleId,
        dtstart: it.dtstart,
        dtend: it.dtend,
        messages: text.trim() ? [{ user_id: myId, msg: text.trim() }] : [],
        previous_reserve: {},
      },
    });

    // TODO: remove the BLOCK slot when cancelling an accepted reservation.
    // Blocked by the same backend limitation as above.

    hardReload();
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((it) => (
        <ReservationCard
          key={it.id}
          item={it}
          actions={
            variant === 'history' ? null : variant === 'pending-mentor' ? (
              <AcceptReservationDialog
                reservation={it}
                onAccept={accept}
                onReject={async ({ id, reason }) => rejectOrCancel(id, reason)}
              />
            ) : (
              <CancelReservationDialog
                reservation={it}
                onConfirmCancel={async ({ id, reason }) =>
                  rejectOrCancel(id, reason)
                }
              />
            )
          }
        />
      ))}

      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            目前尚無資料
          </CardContent>
        </Card>
      )}
    </div>
  );
}

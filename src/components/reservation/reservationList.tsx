// src/components/reservation/reservationList.tsx
'use client';

import { getSession } from 'next-auth/react';

import AcceptReservationDialog from '@/components/reservation/acceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/cancelReservationDialog';
import { Card, CardContent } from '@/components/ui/card';
import { updateReservationStatus } from '@/services/reservations';

import { ReservationCard } from './reservationCard';
import type { Reservation } from './types';

type Variant = 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';

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

  // 由目前登入者決定「對方」 user_id
  const resolveOtherId = (myId: string, it: Reservation): string | number =>
    String(it.senderUserId) === myId ? it.participantUserId : it.senderUserId;

  // 整頁重載
  const hardReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  // Accept（導師 pending-mentor）
  const accept = async ({ id, message }: { id: string; message: string }) => {
    const session = await getSession();
    const myId = String(session?.user?.id ?? '');
    if (!myId) throw new Error('[ReservationList] missing current user id');

    const it = findItem(id);
    const otherId = resolveOtherId(myId, it);

    await updateReservationStatus({
      userId: myId, // path :user_id = 自己
      reservationId: id,
      debug: true,
      body: {
        my_user_id: myId, // 自己
        user_id: otherId, // 對方
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

    hardReload(); // ✅ 成功後整頁重載
  };

  // Reject & Cancel 共用（API 等同）
  const rejectOrCancel = async (id: string, text: string) => {
    const session = await getSession();
    const myId = String(session?.user?.id ?? '');
    if (!myId) throw new Error('[ReservationList] missing current user id');

    const it = findItem(id);
    const otherId = resolveOtherId(myId, it);

    await updateReservationStatus({
      userId: myId,
      reservationId: id,
      debug: true,
      body: {
        my_user_id: myId,
        user_id: otherId, // 對方
        my_status: 'REJECT', // Reject & Cancel
        schedule_id: it.scheduleId,
        dtstart: it.dtstart,
        dtend: it.dtend,
        messages: text.trim() ? [{ user_id: myId, msg: text.trim() }] : [],
        previous_reserve: {},
      },
    });

    hardReload(); // ✅ 成功後整頁重載
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

import AcceptReservationDialog from '@/components/reservation/acceptReservationDialog';
import CancelReservationDialog from '@/components/reservation/cancelReservationDialog';
import { Card, CardContent } from '@/components/ui/card';

import { ReservationCard } from './reservationCard';
import type { Reservation } from './types';

export function ReservationList({
  items,
  variant,
}: {
  items: Reservation[];
  variant: 'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';
}) {
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
                onAccept={async ({ id, message }) => {
                  // TODO: call accept API
                  console.log('ACCEPT', id, message);
                }}
                onReject={async ({ id, reason }) => {
                  // TODO: call reject API
                  console.log('REJECT', id, reason);
                }}
              />
            ) : (
              <CancelReservationDialog
                reservation={it}
                onConfirmCancel={async ({ id, reason }) => {
                  // TODO: 這裡串後端 API
                  // await api.cancelReservation(id, { reason })
                  console.log('cancel confirmed:', id, reason);
                }}
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

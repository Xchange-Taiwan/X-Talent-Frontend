import { CalendarDays, Clock } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type { Reservation } from './types';

export function ReservationCard({
  item,
  actions,
}: {
  item: Reservation;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="border-muted/40 transition-shadow hover:shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
            {item.avatar ? (
              <AvatarImage src={item.avatar} alt={item.name} />
            ) : null}
            <AvatarFallback className="font-medium">
              {item.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </AvatarFallback>
          </Avatar>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="truncate">
                <div className="truncate text-sm font-medium sm:text-base">
                  {item.name}
                </div>
                <div className="truncate text-xs text-muted-foreground sm:text-sm">
                  {item.roleLine}
                </div>
              </div>
            </div>

            {/* Divider only on >=sm to match Figma feel */}
            <div className="my-3 hidden h-px bg-border sm:block" />

            {/* Date & time row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-0 sm:text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.time}</span>
              </div>
              {item.note ? (
                <Badge
                  variant="secondary"
                  className="rounded-full text-[11px] sm:text-xs"
                >
                  {item.note}
                </Badge>
              ) : null}

              {/* Actions (right aligned) */}
              <div className="ml-auto shrink-0">{actions}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

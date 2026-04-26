import { CalendarDays, Clock, MessageSquare } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';

import type { Reservation } from './types';

const COUNTERPARTY_LABEL: Record<'MENTEE' | 'MENTOR', string> = {
  MENTEE: '學員留言',
  MENTOR: 'Mentor 回覆',
};

export function ReservationCard({
  item,
  actions,
}: {
  item: Reservation;
  actions?: React.ReactNode;
}) {
  const { counterpartyMessage } = item;

  return (
    <Card className="border-muted/40 transition-shadow hover:shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
            {item.avatar ? (
              <AvatarImage
                src={getAvatarThumbUrl(item.avatar)}
                alt={item.name}
              />
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
              <div className="min-w-0 truncate">
                <div className="truncate text-sm font-medium sm:text-base">
                  {item.name}
                </div>
                <div className="truncate text-xs text-muted-foreground sm:text-sm">
                  {item.roleLine}
                </div>
              </div>
              <div className="shrink-0">{actions}</div>
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
            </div>

            {counterpartyMessage ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-xs sm:text-sm">
                <MessageSquare
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                    {COUNTERPARTY_LABEL[counterpartyMessage.role]}
                  </div>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-foreground">
                    {counterpartyMessage.content}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

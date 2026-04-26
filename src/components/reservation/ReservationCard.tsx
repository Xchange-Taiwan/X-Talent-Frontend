import { CalendarDays, Clock } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarThumbUrl } from '@/lib/avatar/getAvatarThumbUrl';

import type { Reservation } from './types';

export function ReservationCard({
  item,
  actions,
  profileHref,
  onProfileClick,
}: {
  item: Reservation;
  actions?: React.ReactNode;
  profileHref?: string;
  onProfileClick?: () => void;
}) {
  const initials = item.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const avatar = (
    <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
      {item.avatar ? (
        <AvatarImage src={getAvatarThumbUrl(item.avatar)} alt={item.name} />
      ) : null}
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );

  const profileAriaLabel = `查看 ${item.name} 的個人資料`;

  return (
    <Card className="border-muted/40 transition-shadow hover:shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar */}
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={profileAriaLabel}
              onClick={onProfileClick}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {avatar}
            </Link>
          ) : (
            <div className="shrink-0">{avatar}</div>
          )}

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {profileHref ? (
                <Link
                  href={profileHref}
                  aria-label={profileAriaLabel}
                  onClick={onProfileClick}
                  className="group min-w-0 truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="truncate text-sm font-medium group-hover:underline sm:text-base">
                    {item.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground sm:text-sm">
                    {item.roleLine}
                  </div>
                </Link>
              ) : (
                <div className="min-w-0 truncate">
                  <div className="truncate text-sm font-medium sm:text-base">
                    {item.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground sm:text-sm">
                    {item.roleLine}
                  </div>
                </div>
              )}
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
              {item.note ? (
                <Badge
                  variant="secondary"
                  className="rounded-full text-[11px] sm:text-xs"
                >
                  {item.note}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

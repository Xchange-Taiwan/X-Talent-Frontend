import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { hasUserProperties, isValidUserId } from '@/lib/auth/userGuard';
import { DEFAULT_LOGIN } from '@/routes';

export interface ReservationHistoryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function ReservationHistoryPage({
  searchParams,
}: ReservationHistoryPageProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const reservationId = firstQueryValue(resolvedSearchParams.reservation_id);
  const roleParam = firstQueryValue(resolvedSearchParams.role);

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const rawUserId =
    sessionUser && 'id' in sessionUser && sessionUser.id != null
      ? String(sessionUser.id)
      : undefined;
  if (!hasUserProperties(sessionUser) || !isValidUserId(rawUserId)) {
    const incomingQuery = new URLSearchParams();
    for (const [key, val] of Object.entries(resolvedSearchParams)) {
      if (typeof val === 'string') {
        incomingQuery.set(key, val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          incomingQuery.append(key, item);
        }
      }
    }
    const qs = incomingQuery.toString();
    const callbackPath = qs
      ? `/reservation/history?${qs}`
      : '/reservation/history';
    return redirect(
      `${DEFAULT_LOGIN}?callbackUrl=${encodeURIComponent(callbackPath)}`
    );
  }

  const isSessionMentor =
    'isMentor' in sessionUser && sessionUser.isMentor === true;
  const targetRole =
    roleParam === 'mentor' && isSessionMentor ? 'mentor' : 'mentee';
  const targetParams = new URLSearchParams();
  targetParams.set('tab', 'history');
  if (reservationId) {
    targetParams.set('reservation_id', reservationId);
  }

  return redirect(`/reservation/${targetRole}?${targetParams.toString()}`);
}

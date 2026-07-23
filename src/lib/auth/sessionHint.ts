// Non-sensitive UI hint, written by middleware from a token already verified
// via `getToken()` (local JWT signature check, no network call). Lets the
// client render the correct header shape before the slower `useSession()`
// round trip (which can be blocked on a backend token-refresh call) resolves.
// Never trust this cookie for authorization — it is readable/writable by
// client JS and carries no signature of its own.
export const SESSION_HINT_COOKIE = 'session-hint';

export const SESSION_HINT_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

export interface SessionHint {
  isMentor: boolean;
}

const MENTOR_VALUE = '1';
const NON_MENTOR_VALUE = '0';

export function encodeSessionHint(hint: SessionHint): string {
  return hint.isMentor ? MENTOR_VALUE : NON_MENTOR_VALUE;
}

export function decodeSessionHint(
  value: string | undefined | null
): SessionHint | null {
  if (value === MENTOR_VALUE) return { isMentor: true };
  if (value === NON_MENTOR_VALUE) return { isMentor: false };
  return null;
}

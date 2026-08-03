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
  avatar?: string;
}

const MENTOR_VALUE = '1';
const NON_MENTOR_VALUE = '0';

export function encodeSessionHint(hint: SessionHint): string {
  const isMentorVal = hint.isMentor ? MENTOR_VALUE : NON_MENTOR_VALUE;
  if (hint.avatar) {
    try {
      const encodedAvatar = encodeURIComponent(hint.avatar);
      // Prevent cookie bloat (HTTP 431 Request Header Fields Too Large) by capping length
      if (encodedAvatar.length <= 1000) {
        return `${isMentorVal}|${encodedAvatar}`;
      }
    } catch (err) {
      console.error('Failed to encode avatar URL for session hint:', err);
    }
  }
  return isMentorVal;
}

function isValidAvatarProtocol(url: string): boolean {
  return (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('/')
  );
}

export function decodeSessionHint(
  value: string | undefined | null
): SessionHint | null {
  if (!value) return null;

  const parts = value.split('|');
  const isMentorPart = parts[0];
  const avatarPart = parts[1];

  let isMentor: boolean;
  if (isMentorPart === MENTOR_VALUE) {
    isMentor = true;
  } else if (isMentorPart === NON_MENTOR_VALUE) {
    isMentor = false;
  } else {
    return null;
  }

  const hint: SessionHint = { isMentor };
  if (avatarPart) {
    let avatar: string | undefined;
    try {
      avatar = decodeURIComponent(avatarPart);
    } catch {
      // Decode failed - discard raw value to avoid broken UI links
      avatar = undefined;
    }

    if (avatar && isValidAvatarProtocol(avatar)) {
      hint.avatar = avatar;
    }
  }
  return hint;
}

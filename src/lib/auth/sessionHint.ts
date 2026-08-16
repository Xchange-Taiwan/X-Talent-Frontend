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
  // Not secret - already public via the `/profile/{userId}` URL. Included so
  // nav links can resolve their real href before `useSession()` lands,
  // instead of sitting disabled the whole time. Never used for authorization.
  userId?: string;
  avatar?: string;
}

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | {
      status: 'authenticated';
      isMentor: boolean;
      avatar?: string;
      userId?: string;
    };

const MENTOR_VALUE = '1';
const NON_MENTOR_VALUE = '0';

export function encodeSessionHint(hint: SessionHint): string {
  const isMentorVal = hint.isMentor ? MENTOR_VALUE : NON_MENTOR_VALUE;
  const userIdPart = hint.userId ? encodeURIComponent(hint.userId) : '';
  const base = userIdPart ? `${isMentorVal}|${userIdPart}` : isMentorVal;

  if (!hint.avatar) {
    return base;
  }
  try {
    const encodedAvatar = encodeURIComponent(hint.avatar);
    // Completely omit avatar URL if its encoded form exceeds 1000 characters
    // to avoid massive cookie header overhead (HTTP 431) and broken truncated URLs.
    if (encodedAvatar.length <= 1000) {
      return `${isMentorVal}|${userIdPart}|${encodedAvatar}`;
    }
  } catch {
    // Lone surrogate or otherwise invalid UTF-16 in the avatar URL - fall
    // back to mentor status (and userId) only rather than crashing the caller.
  }
  return base;
}

export function isValidAvatarProtocol(url: string): boolean {
  return (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('/')
  );
}

export function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export function decodeSessionHint(
  cookieValue: string | undefined | null
): SessionHint | null {
  if (!cookieValue) {
    return null;
  }

  const parts = cookieValue.split('|');
  const isMentorPart = parts[0];
  const userIdPart = parts[1];
  const avatarPart = parts[2];

  let isMentor: boolean;
  if (isMentorPart === MENTOR_VALUE) {
    isMentor = true;
  } else if (isMentorPart === NON_MENTOR_VALUE) {
    isMentor = false;
  } else {
    return null;
  }

  const hint: SessionHint = { isMentor };

  if (userIdPart) {
    try {
      const userId = decodeURIComponent(userIdPart);
      if (userId && !isValidAvatarProtocol(userId)) {
        hint.userId = userId;
      }
    } catch {
      // Malformed userId segment - ignore, don't let it break isMentor/avatar.
    }
  }

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

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (raw === undefined) return undefined;
  return safeDecodeURIComponent(raw);
}

export interface ResolvedIdentity {
  userId: string | undefined;
  avatar: string | undefined;
  isMentor: boolean;
  isLoggedIn: boolean;
  hasFullUser: boolean;
  isResolvingUser: boolean;
  authKnown: boolean;
}

export function resolveIdentity(
  override: { userId: string; url: string } | null | undefined,
  session:
    | {
        user?: {
          id?: string | number;
          avatar?: string | null;
          isMentor?: boolean;
        };
      }
    | null
    | undefined,
  status: 'loading' | 'authenticated' | 'unauthenticated',
  hintInput?: SessionHint | null
): ResolvedIdentity {
  const hasFullUser = Boolean(session?.user?.id);
  const sessionSettled = hasFullUser || status !== 'loading';

  let hint: SessionHint | null = null;
  let isHintUnknown = false;
  let isHintGuest = false;

  if (hintInput && typeof hintInput === 'object') {
    hint = hintInput;
  } else if (hintInput === null) {
    isHintGuest = true;
  } else if (hintInput === undefined) {
    isHintUnknown = true;
  }

  const authKnown = sessionSettled || !isHintUnknown;
  const isLoggedIn =
    hasFullUser ||
    (!sessionSettled && !isHintUnknown && !isHintGuest && Boolean(hint));

  // 1. Resolve userId
  const userId = hasFullUser
    ? String(session!.user!.id)
    : sessionSettled
      ? undefined
      : (hint?.userId ?? undefined);

  // 2. Resolve isMentor
  const isMentor = hasFullUser
    ? Boolean(session?.user?.isMentor)
    : sessionSettled
      ? false
      : isLoggedIn && Boolean(hint?.isMentor);

  // 3. Resolve avatar
  let avatar: string | undefined = undefined;
  if (override && userId && override.userId === userId) {
    avatar = override.url;
  } else if (hasFullUser) {
    avatar = session?.user?.avatar ?? undefined;
  } else if (!sessionSettled && isLoggedIn && hint) {
    avatar = hint.avatar ?? undefined;
  }

  const isResolvingUser = isLoggedIn && !userId;

  return {
    userId,
    avatar,
    isMentor,
    isLoggedIn,
    hasFullUser,
    isResolvingUser,
    authKnown,
  };
}

export const DOM_AUTH_STATE_ATTR = 'data-auth-state';
export const DOM_AUTH_AVATAR_ATTR = 'data-auth-avatar';

export function clearSessionHint(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;`;
  document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
  document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
  document.documentElement.style.removeProperty('--auth-avatar');
}

export const SESSION_HINT_INLINE_SCRIPT = `
  (function () {
    try {
      var cookie = document.cookie.split('; ').find(function(row) {
        return row.startsWith('${SESSION_HINT_COOKIE}=');
      });
      var parts = null;
      if (cookie) {
        var rawValue = cookie.substring('${SESSION_HINT_COOKIE}='.length);
        try {
          rawValue = decodeURIComponent(rawValue);
        } catch (_) {}
        parts = rawValue.split('|');
      }
      if (parts && (parts[0] === '1' || parts[0] === '0')) {
        var isMentor = parts[0] === '1';
        var avatar = '';
        if (parts[2]) {
          try {
            avatar = decodeURIComponent(parts[2]);
          } catch (_) {
            avatar = '';
          }
        }

        if (avatar && (avatar.startsWith('https://') || avatar.startsWith('http://') || avatar.startsWith('/'))) {
          document.documentElement.setAttribute('${DOM_AUTH_AVATAR_ATTR}', avatar);
          var escapedAvatar = avatar.replace(/"/g, '%22');
          document.documentElement.style.setProperty('--auth-avatar', 'url("' + escapedAvatar + '")');
        }
        document.documentElement.setAttribute('${DOM_AUTH_STATE_ATTR}', isMentor ? 'mentor' : 'mentee');
      } else {
        document.documentElement.setAttribute('${DOM_AUTH_STATE_ATTR}', 'guest');
      }
    } catch (_) {}
  })();
`;

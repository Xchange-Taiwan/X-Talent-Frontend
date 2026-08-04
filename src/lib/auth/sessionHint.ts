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

export const DOM_AUTH_STATE_ATTR = 'data-auth-state';
export const DOM_AUTH_AVATAR_ATTR = 'data-auth-avatar';

export const SESSION_HINT_INLINE_SCRIPT = `
  try {
    var cookie = document.cookie.split('; ').find(function(row) {
      return row.startsWith('${SESSION_HINT_COOKIE}=');
    });
    if (cookie) {
      var rawValue = cookie.substring('${SESSION_HINT_COOKIE}='.length);
      try {
        rawValue = decodeURIComponent(rawValue);
      } catch (_) {}
      var parts = rawValue.split('|');
      if (parts[0] === '1' || parts[0] === '0') {
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
      }
    }
  } catch (_) {}
`;

/**
 * Frontend Runtime Error Monitoring
 *
 * Captures unhandled JS errors, unhandled promise rejections, React render errors,
 * and API failures. Events are structured consistently and forwarded to Sentry.
 *
 * Sensitive fields are masked before any event is emitted.
 * Sentry is initialized separately in instrumentation-client.ts / sentry.server.config.ts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MonitoringEventName =
  | 'runtime_error.unhandled_js'
  | 'runtime_error.unhandled_rejection'
  | 'runtime_error.react_render'
  | 'api.failure';

export interface MonitoringEvent {
  /** Consistent event name for filtering/grouping in logs */
  name: MonitoringEventName;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** 'production' | 'development' | 'test' */
  environment: string;
  /** window.location.pathname at time of error */
  route: string;
  /** Error.message or rejection reason */
  message: string;
  /** Error.stack if available */
  stack?: string;
  /** React componentStack from ErrorBoundary */
  componentStack?: string;
  /** Component name from ErrorBoundary */
  componentName?: string;
}

/**
 * Structured event for a failed API request.
 * Request/response bodies and auth headers are never included.
 */
export interface ApiFailureEvent {
  name: 'api.failure';
  /** ISO 8601 timestamp */
  timestamp: string;
  /** 'production' | 'development' | 'test' */
  environment: string;
  /** window.location.pathname at time of failure */
  route: string;
  /** API path with sensitive query params masked */
  endpoint: string;
  /** HTTP method: GET, POST, PUT, PATCH, DELETE */
  method: string;
  /** HTTP response status code; 0 for network/DNS errors where no response arrived */
  status: number;
  /** Error message from response body or fetch exception */
  message: string;
  /** Request round-trip duration in milliseconds */
  duration?: number;
}

// ─── Sensitive field masking ───────────────────────────────────────────────────

/**
 * Keys whose values should be masked in error messages / stack traces.
 * Matches case-insensitively.
 *
 * `code` and `secret` cover the OAuth authorization code and client
 * secret NextAuth's Google sign-in flow passes through
 * `/api/auth/callback?code=...` - the code is redeemable for an access
 * token, so it's as sensitive as the token itself.
 *
 * Every other entry here is a substring match (so compound keys like
 * `user_email` or `companyEmail` are still caught), but `code` is
 * written as `^code$` to anchor it to an *exact* match instead. A
 * substring `code` would also mask `errorCode` and `statusCode` -
 * common, non-sensitive diagnostic fields that appear in this
 * codebase's own event shapes (see `FlowFailureEvent.errorCode` below)
 * - destroying their value for debugging every time they show up
 * embedded in a sanitized message. The `^`/`$` anchors apply only to
 * this alternative in the joined regex, not the whole pattern, so the
 * other keys keep their substring behavior.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'email',
  'phone',
  'idnumber',
  '^code$',
  'secret',
];

/**
 * Single precompiled regex to test whether a key contains any sensitive
 * word, used instead of `SENSITIVE_KEYS.some(...).includes(...)` in the
 * hot replace callbacks below - one regex engine pass per key instead of
 * an array scan with a substring search per entry.
 */
const SENSITIVE_KEY_TEST_PATTERN = new RegExp(SENSITIVE_KEYS.join('|'), 'i');

/**
 * Replaces values of sensitive URL query parameters with [REDACTED].
 * e.g. ?token=abc123&password=secret -> ?token=[REDACTED]&password=[REDACTED]
 * e.g. ?email_address=a@b.com -> ?email_address=[REDACTED]
 * e.g. ?user[password]=secret -> ?user[password]=[REDACTED]
 *
 * The key group captures any run of word/hyphen/dot/bracket characters,
 * with the sensitive-word check happening in the callback below via a
 * precompiled test (`SENSITIVE_KEY_TEST_PATTERN`) - mirroring
 * maskSensitiveJsonValues below - rather than requiring the sensitive
 * word to be matched as part of the key inside the regex itself (an
 * earlier version of this pattern). Embedding the keyword in the key
 * alternation is what caused a severe ReDoS: for a long run of
 * key-class characters that repeats a sensitive word many times with no
 * `=` (e.g. `'token'.repeat(32000)`), the engine tried every position
 * where the keyword alternative could match within that one run,
 * backtracking the trailing `[\w.[\]-]*` for each - O(N^2), measured at
 * over a second for a 160k-character input. Checking the key in the
 * callback instead means the key is a single greedy quantifier with no
 * internal choice point, so matching (or failing to match, when there's
 * no trailing `=`) is O(N) with no backtracking to speak of.
 *
 * Trade-off: unlike the embedded-keyword version, a non-sensitive key's
 * value can still "swallow" a sensitive key=value pair that's
 * un-delimited inside it (e.g. in a free-text `url=/login?token=abc`,
 * `token=abc` would otherwise be consumed as part of `url`'s value and
 * never get its own match - the common real-world shape being NextAuth's
 * `callbackUrl=/home?token=secret`). To catch that case, the callback
 * below makes exactly one extra pass over a non-sensitive key's swallowed
 * value, re-running this same match/redact logic on it. That recursion is
 * capped at a single extra level (depth 1) rather than being unbounded:
 * recursing again on *that* pass's own non-sensitive matches would mean a
 * crafted chain like `'k='.repeat(50000)` re-scans an ever-shrinking
 * remainder at every level - the exact O(N^2) shape the embedded-keyword
 * version was replaced to avoid, just moved from regex backtracking into
 * recursion depth. Capping at one extra pass keeps total work at two
 * linear scans regardless of input shape, while still fixing the common
 * one-level-deep swallow case above. A third level of nesting (a URL
 * whose value is itself a URL whose value is itself a URL) is still a
 * known limitation, but this codebase only ever passes flat or
 * one-level-nested query strings/messages through sanitize().
 *
 * The character class includes `.`, `[` and `]` alongside `\w-` so
 * dot notation (`user.email`) and bracket notation (`user[password]`) -
 * both common in query-string/form serialization - are still caught,
 * not just plain word keys.
 *
 * The value alternation tries a double-quoted string, then a
 * single-quoted string, then a bare unquoted run - each quoted form is
 * escape-aware (`(?:[^"\\]|\\.)*`) so a value containing an escaped
 * quote or a literal space doesn't truncate the match early and leak
 * the remainder. A plain `[^&\s]*` alone would stop at the first space
 * inside `password="my secret"`, leaving `secret"` in the output. The
 * bare alternative deliberately still allows `=` (an earlier version
 * excluded it, intending to narrow the swallow trade-off above, but
 * that broke a plain unquoted value that legitimately contains `=` -
 * e.g. base64 padding in a token, or a password that happens to contain
 * `=` - truncating it at the first `=` and leaking the remainder
 * verbatim right after `[REDACTED]`, a worse outcome than the swallow
 * trade-off it was trying to narrow).
 *
 * The leading `(^|[^\w.[\]-])` group anchors where a key is allowed to
 * start: either the very start of the string, or right after a
 * character that can't itself be part of a key. This is a captured
 * group, not a lookbehind assertion (`(?<=...)`), even though the
 * intent is lookbehind-like: lookbehind isn't supported in Safari
 * before 16.4, and this pattern is built via `new RegExp` at module
 * load time, so using it here would throw a SyntaxError and crash the
 * module - and the whole page - on any older Safari/iOS. The matched
 * boundary character is consumed and captured instead, then echoed back
 * unchanged in the callback below.
 */
const SENSITIVE_QUERY_PARAM_PATTERN = new RegExp(
  `(^|[^\\w.[\\]-])([\\w.[\\]-]+)=("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^&\\s]*)`,
  'gi'
);

function maskSensitiveQueryParams(text: string, depth = 0): string {
  return text.replace(
    SENSITIVE_QUERY_PARAM_PATTERN,
    (match, prefix, key, value) => {
      if (SENSITIVE_KEY_TEST_PATTERN.test(key)) {
        return `${prefix}${key}=[REDACTED]`;
      }
      // Only ever recurse one extra level deep, and only when the
      // swallowed value could possibly contain another key=value pair -
      // see the capped-recursion trade-off documented above.
      if (depth === 0 && value.includes('=')) {
        return `${prefix}${key}=${maskSensitiveQueryParams(value, depth + 1)}`;
      }
      return match;
    }
  );
}

/**
 * Hard ceiling on recursion depth for both `maskSensitiveJsonNode` (the
 * parsed-tree walker) and the fallback-recursion inside
 * `maskSensitiveJsonValues` below. Pathological or maliciously crafted
 * input (tens of thousands of nested arrays/objects) could otherwise blow
 * the JS call stack. A value nested deeper than this is redacted outright
 * rather than passed through unmasked - past this depth we can no longer
 * verify it doesn't contain a sensitive key, and passing it through raw
 * would defeat the point of this function. 100 levels comfortably covers
 * any real-world payload while staying far below JS engines' default
 * stack limits.
 */
const MAX_JSON_MASK_DEPTH = 100;

/**
 * Recursively masks sensitive keys in an already-`JSON.parse`d value.
 *
 * Walking the real object tree (rather than scanning text with a regex)
 * is what lets this reach a sensitive key's value no matter how deeply
 * it's nested - a nested array/object under a sensitive key is replaced
 * with `[REDACTED]` wholesale without needing to descend into it, and a
 * non-sensitive array/object is walked element-by-element / key-by-key
 * so a sensitive key buried inside it still gets masked.
 */
function maskSensitiveJsonNode(value: unknown, depth = 0): unknown {
  if (depth > MAX_JSON_MASK_DEPTH) {
    return Array.isArray(value) || (value !== null && typeof value === 'object')
      ? '[REDACTED]'
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveJsonNode(item, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, nodeValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      masked[key] = SENSITIVE_KEY_TEST_PATTERN.test(key)
        ? '[REDACTED]'
        : maskSensitiveJsonNode(nodeValue, depth + 1);
    }
    return masked;
  }

  return value;
}

/**
 * Matches either a quoted JSON string (consumed and left untouched) or a
 * standalone run of 16+ digits (optionally signed) that isn't part of a
 * decimal fraction or an exponent - i.e. a bare JSON integer literal long
 * enough to exceed `Number.MAX_SAFE_INTEGER` and lose precision when read
 * into a JS `number`. The leading `(^|[^\d.])` group anchors the digit run
 * to its true start without a lookbehind (see the identical technique on
 * `SENSITIVE_QUERY_PARAM_PATTERN` above for why lookbehind is avoided
 * here), and is echoed back unchanged by both helpers below.
 */
const BIG_INTEGER_PATTERN =
  /"(?:[^"\\]|\\.)*"|(^|[^\d.])(-?\d{16,})(?![.\deE])/g;

/**
 * A private-use-area marker (not a control character, so it survives
 * `JSON.parse`/`JSON.stringify` unescaped) used to wrap a big integer
 * literal as a JSON string before parsing, so its exact digits round-trip
 * through `maskSensitiveJsonNode` instead of being coerced into a lossy
 * JS `number` and back.
 */
const BIG_INTEGER_MARKER = 'BIGINT';

/**
 * Wraps big integer literals (e.g. a 64-bit database id or a Snowflake
 * id) in a marked JSON string before `JSON.parse`, so the recursive
 * mask-and-reserialize round trip in `maskSensitiveJsonValues` doesn't
 * silently corrupt them the way plain `JSON.parse`/`JSON.stringify` would
 * (JS numbers only carry 53 bits of integer precision). Only applied on
 * the `JSON.parse` fast path - the regex fallback path never parses
 * numbers at all, so it has no precision to lose.
 */
function protectBigIntegers(text: string): string {
  return text.replace(BIG_INTEGER_PATTERN, (match, boundary, bigInt) =>
    bigInt === undefined ? match : `${boundary}"${BIG_INTEGER_MARKER}${bigInt}"`
  );
}

/**
 * Precompiled once at module load, since the marker is a fixed constant -
 * avoids rebuilding the same `RegExp` on every `restoreBigIntegers` call.
 */
const RESTORE_BIG_INTEGER_PATTERN = new RegExp(
  `"${BIG_INTEGER_MARKER}(-?\\d+)"`,
  'g'
);

/**
 * Reverses `protectBigIntegers` after masking + re-serialization, turning
 * a marked sentinel string back into the original bare integer literal.
 * A sensitive key's big-integer value never reaches this step at all - it
 * was already collapsed to the literal string `[REDACTED]` by
 * `maskSensitiveJsonNode` before serialization - so this only ever
 * restores integers that were never masked in the first place.
 */
function restoreBigIntegers(text: string): string {
  return text.replace(RESTORE_BIG_INTEGER_PATTERN, (_match, bigInt) => bigInt);
}

/**
 * Replaces values of sensitive keys in JSON-like strings with [REDACTED].
 * e.g. "password":"secret" -> "password":"[REDACTED]"
 * e.g. "phone":987654321 -> "phone":"[REDACTED]"
 * e.g. "user.email":"a@b.com" -> "user.email":"[REDACTED]"
 * e.g. {"password":[["nested"],"plain_secret"]} -> {"password":"[REDACTED]"}
 * e.g. Error: {"user":{"password":"secret"}} -> Error: {"user":{"password":"[REDACTED]"}}
 *
 * When `text` looks like it could be JSON (starts with `{` or `[` once
 * leading whitespace is trimmed), it's parsed with `JSON.parse`, walked
 * recursively via `maskSensitiveJsonNode` to mask every sensitive key
 * regardless of nesting depth, then re-serialized with `JSON.stringify`.
 * `JSON.parse` is a real parser, not a regex, so this path is immune to
 * the shallow-match / ReDoS failure modes a hand-rolled bracket-matching
 * regex would have for arbitrarily nested structures - do not replace it
 * with one. Big integers are protected from `JSON.parse`'s number
 * precision loss via `protectBigIntegers`/`restoreBigIntegers` around
 * this path. The leading-character check is a cheap guard so the common
 * case - a plain free-text error message - skips straight to the regex
 * path below instead of paying for a `JSON.parse` call that's certain to
 * throw.
 *
 * `text` is not always valid JSON even when it looks like it, though - it
 * can be free text with an embedded `key: value` fragment, or a
 * JSON-shaped blob sitting inside a larger error message (e.g.
 * `Request failed: {"password":...}`). For that case `JSON.parse` throws
 * and this falls back to the regex-based scan below, which finds
 * `"key":value` pairs anywhere in the text without requiring the whole
 * string to be valid JSON.
 *
 * The fallback regex's key group captures any run of non-quote characters
 * rather than `[\w-]+` (a previous version of this pattern), so keys
 * containing dots or other punctuation - e.g. a flattened `"user.email"`
 * key - are still matched instead of silently passing through unmasked.
 * The substring check happens in the callback via a precompiled regex test
 * (`SENSITIVE_KEY_TEST_PATTERN`), so compound keys like "user_email" or
 * "companyEmail" are still caught, not just a literal "email" key - same
 * PII-safety trade-off as SENSITIVE_QUERY_PARAM_PATTERN above.
 *
 * The value alternation also matches bare JSON number/boolean/null
 * literals, not just quoted strings - a sensitive field sent as a
 * non-string value (e.g. a numeric phone or id number) would otherwise
 * have no surrounding quotes for the old string-only pattern to match,
 * letting it through in plain text. The number branch includes an
 * optional exponent suffix (`(?:[eE][+-]?\d+)?`) since plain JSON
 * numbers allow scientific notation (e.g. `"phone":12345e2`) - without
 * it, only the `12345` part would match and get redacted, leaving the
 * `e2` behind as literal trailing text and producing invalid JSON
 * (`"phone":"[REDACTED]"e2`).
 *
 * The quoted-string branch is escape-aware (`(?:[^"\\]|\\.)*`) rather
 * than a plain `[^"]*`, which would stop at the first escaped quote
 * inside the value (e.g. `"password":"my\"secret"`) and leave
 * everything after it - including the rest of the secret - untouched.
 *
 * The `\[(?:[^\]"\\]|"(?:[^"\\]|\\.)*")*\]` alternative matches a flat
 * JSON array (e.g. `"emails":["a@test.com","b@test.com"]`) so an
 * array-shaped sensitive value collapses to a single redacted string
 * instead of passing through untouched - none of the other alternatives
 * have a `[` branch, so without this an array value simply wouldn't
 * match at all. It's quote-aware rather than a plain `\[[^\]]*\]`: the
 * latter stops at the *first* `]` anywhere, including one inside a
 * string element's value (e.g. `["my]password"]`), which would truncate
 * the match early and leave everything after it - including the rest of
 * that secret and any further array elements - untouched.
 *
 * The final `\{(?:[^}"\\]|"(?:[^"\\]|\\.)*")*\}` alternative is the same
 * idea for a flat JSON object value (e.g. a Mongo-style
 * `"email":{"$eq":"user@test.com"}`, or `"password":{"value":"secret"}`)
 * - without it, none of the other alternatives match a value starting
 * with `{`, so the whole object would be skipped by this outer call and
 * only get processed by the *next* match attempt inside it, at which
 * point the inner key (`$eq`, `value`) usually isn't itself a sensitive
 * word, letting the real PII inside leak untouched.
 *
 * The array and object branches here still only capture one level at a
 * time - but when the *key* they're attached to isn't itself sensitive,
 * the callback now recurses back into `maskSensitiveJsonValues` on that
 * captured value instead of passing it through untouched. That single
 * recursive call is what stops a sensitive field nested inside a
 * non-sensitive wrapper (e.g. `{"user":{"password":"secret"}}`, where
 * `user` isn't a sensitive key but its value contains one that is) from
 * leaking in the free-text fallback path: each recursive call peels off
 * exactly one matching bracket pair and hands the rest back to the same
 * function, so multiple levels of wrapping resolve correctly one layer
 * at a time even though no single call sees more than one layer. The
 * recursion is bounded by `MAX_JSON_MASK_DEPTH` for the same reason
 * `maskSensitiveJsonNode` is.
 */
function maskSensitiveJsonValues(text: string, depth = 0): string {
  if (depth > MAX_JSON_MASK_DEPTH) {
    return '"[REDACTED]"';
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(protectBigIntegers(text));
      return restoreBigIntegers(JSON.stringify(maskSensitiveJsonNode(parsed)));
    } catch {
      // Not valid JSON despite looking like it - fall through to the
      // regex-based scan below.
    }
  }

  return text.replace(
    /"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|\[(?:[^\]"\\]|"(?:[^"\\]|\\.)*")*\]|\{(?:[^}"\\]|"(?:[^"\\]|\\.)*")*\})/g,
    (match, key, value) => {
      if (SENSITIVE_KEY_TEST_PATTERN.test(key)) {
        return `"${key}":"[REDACTED]"`;
      }
      if (value.startsWith('{') || value.startsWith('[')) {
        return `"${key}":${maskSensitiveJsonValues(value, depth + 1)}`;
      }
      return match;
    }
  );
}

export function sanitize(text: string | undefined): string | undefined {
  if (!text) return text;
  return maskSensitiveJsonValues(maskSensitiveQueryParams(text));
}

// ─── Sentry Dispatch Helper ───────────────────────────────────────────────────

/**
 * Dynamically loads Sentry and dispatches an event.
 * Safely handles any dynamic import errors.
 */
async function dispatchSentryEvent(
  event: Record<string, unknown>,
  fallbackMsg: string
): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureEvent(event);
  } catch (err) {
    console.error(fallbackMsg, err);
  }
}

// ─── Core capture function ─────────────────────────────────────────────────────

/**
 * Emits a structured monitoring event to console.error.
 * Only active in production to avoid noise during development.
 *
 * To integrate a third-party service (e.g. Sentry), replace the
 * console.error call below with the service's SDK call.
 */
export async function captureError(event: MonitoringEvent): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  const sanitizedEvent: MonitoringEvent = {
    ...event,
    message: sanitize(event.message) ?? event.message,
    stack: sanitize(event.stack),
    componentStack: sanitize(event.componentStack),
  };

  await dispatchSentryEvent(
    {
      message: sanitizedEvent.message,
      level: 'error',
      tags: {
        event_name: sanitizedEvent.name,
        route: sanitizedEvent.route,
        environment: sanitizedEvent.environment,
      },
      extra: {
        stack: sanitizedEvent.stack,
        componentStack: sanitizedEvent.componentStack,
        componentName: sanitizedEvent.componentName,
      },
    },
    '[Monitoring] captureError Sentry logging failed:'
  );
}

// ─── Helper to build a base event ─────────────────────────────────────────────

export function buildBaseEvent(
  name: MonitoringEventName,
  error: unknown
): MonitoringEvent {
  const err = error instanceof Error ? error : null;

  return {
    name,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    message: err?.message ?? String(error),
    stack: err?.stack,
  };
}

// ─── Flow failure capture ─────────────────────────────────────────────────────

/**
 * Severity for flow-failure events.
 * - 'error' (default): unexpected system or network failure
 * - 'warning': expected-but-abnormal (rate limits, sync timeouts, conflicts)
 * - 'info': expected user-input failure (wrong password, email already taken)
 */
type FlowFailureLevel = 'error' | 'warning' | 'info';

/**
 * Structured event for a failure in a critical user flow.
 * Distinguishable from generic runtime errors and API failures by the
 * flow + step fields, which identify exactly where in a user journey
 * the failure occurred.
 *
 * Never includes sensitive form values (passwords, tokens, personal info).
 */
export interface FlowFailureEvent {
  /** Naming convention: flow.<flow_name>.failure */
  name: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** 'production' | 'development' | 'test' */
  environment: string;
  /** window.location.pathname at time of failure */
  route: string;
  /** Flow identifier: 'sign_in' | 'sign_up' | 'profile_update' | etc. */
  flow: string;
  /** Step within the flow where the failure occurred */
  step: string;
  /** Error message (sanitized) */
  message: string;
  /** Optional error/status code from the API or SDK */
  errorCode?: string | number;
  /** Severity forwarded to Sentry; defaults to 'error' when omitted */
  level?: FlowFailureLevel;
}

/**
 * Captures a failure in a critical user flow and forwards it to Sentry.
 * Only active in production to avoid noise during development.
 *
 * Do NOT include passwords, tokens, emails, or any sensitive form values
 * in the message or errorCode fields.
 */
export async function captureFlowFailure(
  event: Omit<
    FlowFailureEvent,
    'name' | 'timestamp' | 'environment' | 'route'
  > &
    Partial<Pick<FlowFailureEvent, 'route'>>
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  const fullEvent: FlowFailureEvent = {
    name: `flow.${event.flow}.failure`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    route:
      event.route ??
      (typeof window !== 'undefined' ? window.location.pathname : ''),
    flow: event.flow,
    step: event.step,
    message: sanitize(event.message) ?? event.message,
    errorCode: event.errorCode,
    level: event.level ?? 'error',
  };

  await dispatchSentryEvent(
    {
      message: fullEvent.name,
      level: fullEvent.level,
      tags: {
        event_name: fullEvent.name,
        flow: fullEvent.flow,
        step: fullEvent.step,
        route: fullEvent.route,
      },
      extra: {
        message: fullEvent.message,
        errorCode: fullEvent.errorCode,
        timestamp: fullEvent.timestamp,
      },
    },
    '[Monitoring] captureFlowFailure Sentry logging failed:'
  );
}

// ─── API failure capture ───────────────────────────────────────────────────────

/**
 * Emits a structured api.failure event to console.error.
 * Only active in production to avoid noise during development.
 *
 * Never includes request/response bodies or authorization headers.
 * Sensitive query parameters in the endpoint URL are masked.
 */
export async function captureApiFailure(
  event: Omit<ApiFailureEvent, 'name' | 'timestamp' | 'environment' | 'route'> &
    Partial<Pick<ApiFailureEvent, 'route'>>
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  const fullEvent: ApiFailureEvent = {
    name: 'api.failure',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'unknown',
    route:
      event.route ??
      (typeof window !== 'undefined' ? window.location.pathname : ''),
    endpoint: sanitize(event.endpoint) ?? event.endpoint,
    method: event.method,
    status: event.status,
    message: sanitize(event.message) ?? event.message,
    duration: event.duration,
  };

  await dispatchSentryEvent(
    {
      message: fullEvent.message,
      level: 'error',
      tags: {
        event_name: 'api.failure',
        route: fullEvent.route,
        method: fullEvent.method,
        status: String(fullEvent.status),
      },
      extra: {
        endpoint: fullEvent.endpoint,
        duration: fullEvent.duration,
      },
    },
    '[Monitoring] captureApiFailure Sentry logging failed:'
  );
}

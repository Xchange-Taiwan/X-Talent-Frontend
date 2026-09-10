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
 * token, so it's as sensitive as the token itself. Being substring keys
 * (like the rest of this list) they'll also mask unrelated compound
 * fields such as `errorCode` or `statusCode` if those ever appear
 * embedded in a sanitized message - an accepted over-redaction
 * trade-off, same as every other key here.
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
  'code',
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
 * Captures the whole key (a run of word/hyphen/dot/bracket characters)
 * as long as it *contains* a sensitive word anywhere in it, not just
 * immediately before `=`. The key is deliberately matched inside the
 * regex itself (rather than captured broadly and filtered in the
 * callback, as maskSensitiveJsonValues does) - this text is free-form,
 * not quote-delimited, so a broad `[^=&]+` key would greedily swallow
 * an entire unrelated `key=value` pair that comes before a real one on
 * the same line (e.g. in `url=/login?token=abc123`, the whole
 * `url=/login?token` would be consumed as one non-sensitive match,
 * hiding `token=abc123` from ever being matched on its own). Requiring
 * the sensitive word to already be part of the matched run keeps the
 * regex engine's backtracking naturally skipping over irrelevant
 * prefixes and restarting right at the real key.
 *
 * The character class includes `.`, `[` and `]` alongside `\w-` so
 * dot notation (`user.email`) and bracket notation (`user[password]`) -
 * both common in query-string/form serialization - are still caught,
 * not just plain word keys. Over-redacting the rare benign key that
 * happens to contain a sensitive word is an acceptable trade-off for
 * PII protection.
 *
 * The value alternation tries a double-quoted string, then a
 * single-quoted string, then a bare unquoted run - each quoted form is
 * escape-aware (`(?:[^"\\]|\\.)*`) so a value containing an escaped
 * quote or a literal space doesn't truncate the match early and leak
 * the remainder. A plain `[^&\s]*` alone would stop at the first space
 * inside `password="my secret"`, leaving `secret"` in the output.
 *
 * The leading `(^|[^\w.[\]-])` group anchors where a key is allowed to
 * start: either the very start of the string, or right after a
 * character that can't itself be part of a key. Without it, a long run
 * of key-class characters that never resolves to a sensitive word (e.g.
 * a huge base64 blob with no `=`) forces the engine to retry the greedy
 * `[\w.[\]-]*` from every single character offset within that run, each
 * retry backtracking across the whole remaining run - O(N^2) for an
 * N-character run, measured at ~27s for a 200k-character non-matching
 * string. Because only the first character of a contiguous key-class
 * run satisfies this, the engine now attempts the expensive match once
 * per run instead of once per character - the same 200k-character case
 * verified at well under 1ms.
 *
 * This is a captured group, not a lookbehind assertion (`(?<=...)`),
 * even though the intent is lookbehind-like: lookbehind isn't supported
 * in Safari before 16.4, and this pattern is built via `new RegExp` at
 * module load time, so using it here would throw a SyntaxError and
 * crash the module - and the whole page - on any older Safari/iOS.
 * The matched boundary character is consumed and captured instead, then
 * echoed back unchanged in the callback below.
 */
const SENSITIVE_QUERY_PARAM_PATTERN = new RegExp(
  `(^|[^\\w.[\\]-])([\\w.[\\]-]*(?:${SENSITIVE_KEYS.join('|')})[\\w.[\\]-]*)=("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^&\\s]*)`,
  'gi'
);

function maskSensitiveQueryParams(text: string): string {
  return text.replace(
    SENSITIVE_QUERY_PARAM_PATTERN,
    (match, prefix, key, _value) => {
      return `${prefix}${key}=[REDACTED]`;
    }
  );
}

/**
 * Replaces values of sensitive keys in JSON-like strings with [REDACTED].
 * e.g. "password":"secret" -> "password":"[REDACTED]"
 * e.g. "phone":987654321 -> "phone":"[REDACTED]"
 * e.g. "user.email":"a@b.com" -> "user.email":"[REDACTED]"
 *
 * The key group captures any run of non-quote characters rather than
 * `[\w-]+` (a previous version of this pattern), so keys containing
 * dots or other punctuation - e.g. a flattened `"user.email"` key -
 * are still matched instead of silently passing through unmasked. The
 * substring check happens in the callback via a precompiled regex test
 * (`SENSITIVE_KEY_TEST_PATTERN`), so compound keys like "user_email" or
 * "companyEmail" are still caught, not just a literal "email" key -
 * same PII-safety trade-off as SENSITIVE_QUERY_PARAM_PATTERN above.
 *
 * The value alternation also matches bare JSON number/boolean/null
 * literals, not just quoted strings - a sensitive field sent as a
 * non-string value (e.g. a numeric phone or id number) would otherwise
 * have no surrounding quotes for the old string-only pattern to match,
 * letting it through in plain text.
 *
 * The quoted-string branch is escape-aware (`(?:[^"\\]|\\.)*`) rather
 * than a plain `[^"]*`, which would stop at the first escaped quote
 * inside the value (e.g. `"password":"my\"secret"`) and leave
 * everything after it - including the rest of the secret - untouched.
 *
 * The final `\[[^\]]*\]` alternative matches a flat JSON array (e.g.
 * `"emails":["a@test.com","b@test.com"]`) so an array-shaped sensitive
 * value collapses to a single redacted string instead of passing
 * through untouched - none of the earlier alternatives have a `[`
 * branch, so without this an array value simply wouldn't match at all.
 * This is a shallow match (no nested array/object support) consistent
 * with the rest of this function's regex-based, not a real parser,
 * approach.
 */
function maskSensitiveJsonValues(text: string): string {
  return text.replace(
    /"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|true|false|null|\[[^\]]*\])/g,
    (match, key, _value) => {
      if (SENSITIVE_KEY_TEST_PATTERN.test(key)) {
        return `"${key}":"[REDACTED]"`;
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
export type FlowFailureLevel = 'error' | 'warning' | 'info';

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

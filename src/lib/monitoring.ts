/**
 * Frontend Runtime Error Monitoring
 *
 * Captures unhandled JS errors, unhandled promise rejections, and React render errors.
 * Events are structured consistently and sent to console.error (Vercel / deployment logs).
 * Architecture keeps `captureError` as a single integration point — swap in Sentry or
 * another service here without touching any other file.
 *
 * Sensitive fields are masked before any event is emitted.
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
];

/**
 * Replaces values of sensitive URL query parameters with [REDACTED].
 * e.g. ?token=abc123 → ?token=[REDACTED]
 */
function maskSensitiveQueryParams(text: string): string {
  return text.replace(
    /([?&])([\w-]+)=([^&\s]*)/g,
    (match, separator, key, _value) => {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        return `${separator}${key}=[REDACTED]`;
      }
      return match;
    }
  );
}

/**
 * Replaces values of sensitive keys in JSON-like strings with [REDACTED].
 * e.g. "password":"secret" → "password":"[REDACTED]"
 */
function maskSensitiveJsonValues(text: string): string {
  return text.replace(/"([\w-]+)"\s*:\s*"([^"]*)"/g, (match, key, _value) => {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      return `"${key}":"[REDACTED]"`;
    }
    return match;
  });
}

function sanitize(text: string | undefined): string | undefined {
  if (!text) return text;
  return maskSensitiveJsonValues(maskSensitiveQueryParams(text));
}

// ─── Core capture function ─────────────────────────────────────────────────────

/**
 * Emits a structured monitoring event to console.error.
 * Only active in production to avoid noise during development.
 *
 * To integrate a third-party service (e.g. Sentry), replace the
 * console.error call below with the service's SDK call.
 */
export function captureError(event: MonitoringEvent): void {
  if (process.env.NODE_ENV !== 'production') return;

  const sanitizedEvent: MonitoringEvent = {
    ...event,
    message: sanitize(event.message) ?? event.message,
    stack: sanitize(event.stack),
    componentStack: sanitize(event.componentStack),
  };

  // Single integration point — swap for Sentry.captureEvent() or similar here
  console.error('[monitoring]', sanitizedEvent);
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

// ─── API failure capture ───────────────────────────────────────────────────────

/**
 * Emits a structured api.failure event to console.error.
 * Only active in production to avoid noise during development.
 *
 * Never includes request/response bodies or authorization headers.
 * Sensitive query parameters in the endpoint URL are masked.
 */
export function captureApiFailure(
  event: Omit<ApiFailureEvent, 'name' | 'timestamp' | 'environment' | 'route'> &
    Partial<Pick<ApiFailureEvent, 'route'>>
): void {
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

  // Single integration point — swap for Sentry.captureEvent() or similar here
  console.error('[monitoring]', fullEvent);
}

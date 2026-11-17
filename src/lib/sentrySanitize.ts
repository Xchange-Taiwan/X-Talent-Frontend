import type { ErrorEvent, EventHint } from '@sentry/nextjs';

import { sanitize } from '@/lib/monitoring';

const SENSITIVE_KEY_PATTERN =
  /(?:^|[_-])(?:authorization|cookie|set-cookie|x-api-key|x-auth-token|password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|email|ip_address)(?:$|[_-])/i;

const SAFE_SENTRY_USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SCRUB_DEPTH = 8;

export function sanitizeSentryUserId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.includes('@')) return null;
  return SAFE_SENTRY_USER_ID_RE.test(trimmed) ? trimmed : null;
}

function scrubUnknownValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_SCRUB_DEPTH) return '[REDACTED]';

  if (typeof value === 'string') {
    return sanitize(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknownValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>
    )) {
      const normalizedKey = key
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2');
      if (SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = scrubUnknownValue(entry, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function scrubRecordValues(
  record: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!record || typeof record !== 'object') return record;
  return scrubUnknownValue(record, 0) as Record<string, unknown>;
}

export function sanitizeSentryEvent(
  event: ErrorEvent,
  _hint?: EventHint
): ErrorEvent {
  const next: ErrorEvent = { ...event };

  if (typeof next.message === 'string') {
    next.message = sanitize(next.message) ?? next.message;
  }

  if (next.exception?.values) {
    let unhandledTag: string | null = null;
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((ex) => {
        if (ex.mechanism?.handled === false && !unhandledTag) {
          unhandledTag =
            ex.mechanism.type === 'onunhandledrejection'
              ? 'runtime_error.unhandled_rejection'
              : 'runtime_error.unhandled_js';
        }
        return {
          ...ex,
          value:
            typeof ex.value === 'string'
              ? (sanitize(ex.value) ?? ex.value)
              : ex.value,
        };
      }),
    };
    if (unhandledTag && !next.tags?.event_name) {
      next.tags = {
        ...next.tags,
        event_name: unhandledTag,
      };
    }
  }

  if (next.request) {
    next.request = {
      ...next.request,
      url:
        typeof next.request.url === 'string'
          ? (sanitize(next.request.url) ?? next.request.url)
          : next.request.url,
      query_string:
        typeof next.request.query_string === 'string'
          ? (sanitize(next.request.query_string) ?? next.request.query_string)
          : next.request.query_string,
      headers: scrubRecordValues(
        next.request.headers as Record<string, unknown> | undefined
      ) as Record<string, string> | undefined,
      cookies: next.request.cookies
        ? { '[REDACTED]': '[REDACTED]' }
        : undefined,
      data: scrubUnknownValue(next.request.data, 0),
    };
  }

  if (next.user) {
    const safeId = sanitizeSentryUserId(next.user.id);
    next.user = safeId ? { id: safeId } : undefined;
  }

  if (next.extra) {
    next.extra = scrubRecordValues(next.extra);
  }

  if (next.contexts) {
    next.contexts = scrubRecordValues(
      next.contexts as Record<string, unknown>
    ) as ErrorEvent['contexts'];
  }

  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((crumb) => ({
      ...crumb,
      message:
        typeof crumb.message === 'string'
          ? (sanitize(crumb.message) ?? crumb.message)
          : crumb.message,
      data: scrubRecordValues(crumb.data),
    }));
  }

  return next;
}

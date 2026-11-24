import { upgradeClaritySession } from '@/lib/analytics';
import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import { quickReplyFormSchema } from '@/schemas/quickReplySchema';
import {
  acceptReservation,
  rejectOrCancelReservation,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

/* ============================================================================
 * Vocabulary
 * ========================================================================== */

/** The three review decisions a party can take on an existing reservation. */
export type ReservationDecisionKind = 'accept' | 'reject' | 'cancel';

export type ReservationDecisionRole = 'mentee' | 'mentor';

export interface ReservationDecisionAcceptInput {
  message: string;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationDecisionRole;
}

export interface ReservationDecisionRejectOrCancelInput {
  text: string;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationDecisionRole;
}

/**
 * Write port for reservation decisions. The default adapter delegates to the
 * reservation mutation service (which owns cache reconciliation and 409
 * classification into `ReservationVersionConflictError`); tests and
 * Storybook inject in-memory fakes.
 */
export interface ReservationDecisionPort {
  accept(input: ReservationDecisionAcceptInput): Promise<void>;
  rejectOrCancel(input: ReservationDecisionRejectOrCancelInput): Promise<void>;
}

export const defaultReservationDecisionPort: ReservationDecisionPort = {
  accept: ({ message, reservation, myUserId, myRole }) =>
    acceptReservation({ message, reservation, myUserId, myRole }),
  rejectOrCancel: ({ text, reservation, myUserId, myRole }) =>
    rejectOrCancelReservation({ text, reservation, myUserId, myRole }),
};

export interface ReservationDecisionTelemetryPorts {
  captureFlowFailure?: typeof captureFlowFailure;
  upgradeClaritySession?: typeof upgradeClaritySession;
}

export interface ReservationDecisionNotice {
  title?: string;
  description: string;
}

export const RESERVATION_DECISION_SUCCESS_NOTICE: Readonly<
  Record<ReservationDecisionKind, ReservationDecisionNotice>
> = {
  accept: {
    title: '已接受預約',
    description: '會議連結將於數分鐘內寄至雙方信箱',
  },
  reject: { description: '已拒絕預約' },
  cancel: { description: '已取消預約' },
};

export const RESERVATION_DECISION_ERROR_COPY: Readonly<
  Record<ReservationDecisionKind, string>
> = {
  accept: '接受預約失敗,請稍後再試',
  reject: '拒絕預約失敗,請稍後再試',
  cancel: '取消預約失敗,請稍後再試',
};

export const RESERVATION_REASON_REQUIRED_MESSAGE = '請輸入原因';

/** Clarity recording-retention reason for any failed decision (#950: no GA4 error events). */
export const RESERVATION_DECISION_CLARITY_REASON =
  'reservation_decision_failed';

/** Matches the flow names the mutation layer already reports under. */
const MONITORING_FLOW_BY_KIND: Readonly<
  Record<ReservationDecisionKind, 'reservation_accept' | 'reservation_reject'>
> = {
  accept: 'reservation_accept',
  reject: 'reservation_reject',
  cancel: 'reservation_reject',
};

export type ReservationDecisionFailureReason =
  'invalid_input' | 'version_conflict' | 'api_error';

export type ReservationDecisionResult =
  | {
      ok: true;
      kind: ReservationDecisionKind;
      /** The trimmed reply / reason actually sent. */
      text: string;
      notice: ReservationDecisionNotice;
    }
  | {
      ok: false;
      kind: ReservationDecisionKind;
      reason: ReservationDecisionFailureReason;
      /** User-facing (zh-TW) explanation, safe to show in a toast. */
      message: string;
    };

export type ReservationDecisionValidation =
  { ok: true; value: string } | { ok: false; message: string };

/* ============================================================================
 * Validation
 * ========================================================================== */

/**
 * Single validation rule for decision text:
 * - `accept`: optional quick reply, trimmed, max 500 chars (`quickReplyFormSchema`).
 * - `reject` / `cancel`: required, non-blank reason.
 */
export function validateReservationDecisionText(
  kind: ReservationDecisionKind,
  text: string | undefined
): ReservationDecisionValidation {
  if (kind === 'accept') {
    const parsed = quickReplyFormSchema.safeParse({ reply: text ?? '' });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? '回覆訊息格式不正確',
      };
    }
    return { ok: true, value: (parsed.data.reply ?? '').trim() };
  }

  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { ok: false, message: RESERVATION_REASON_REQUIRED_MESSAGE };
  }
  return { ok: true, value: trimmed };
}

/**
 * Narrow guard for UI callers: true only for a named `{ ok: false }` result
 * (including adapter-level results such as `{ ok: false, reason: 'in_flight' }`).
 * `undefined` / legacy `void` callbacks count as success.
 */
export function isFailedReservationDecision(
  value: unknown
): value is { ok: false } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false
  );
}

/**
 * Telemetry must never break the decision flow itself - the emitter is
 * resolved lazily inside the guard so even a missing binding is tolerated.
 */
function safeEmit<TArgs extends unknown[]>(
  resolveEmit: () => ((...args: TArgs) => unknown) | undefined,
  ...args: TArgs
): void {
  try {
    const emit = resolveEmit();
    if (typeof emit !== 'function') return;
    const maybePromise = emit(...args);
    if (maybePromise instanceof Promise) {
      maybePromise.catch(() => {});
    }
  } catch {
    // Swallow: monitoring failures are not user-facing failures.
  }
}

function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof ReservationVersionConflictError ||
    (error instanceof ApiError && error.status === 409)
  );
}

/* ============================================================================
 * Workflow
 * ========================================================================== */

export interface ExecuteReservationDecisionParams {
  kind: ReservationDecisionKind;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationDecisionRole;
  /** Quick reply for `accept` (optional), reason for `reject` / `cancel` (required). */
  text?: string;
  port?: ReservationDecisionPort;
  telemetry?: ReservationDecisionTelemetryPorts;
}

/**
 * Pure reservation decision workflow (zero React / Next / Hook dependencies).
 *
 * Validates the quick reply / reason, runs the write through the injected
 * `ReservationDecisionPort`, classifies 409 version conflicts vs generic
 * failures, emits zero-PII monitoring, and always resolves to a named
 * `ReservationDecisionResult` (never throws).
 *
 * Telemetry boundaries (#950):
 * - Success: no client event (decision outcomes are counted by the backend).
 * - `version_conflict`: info-level Sentry flow event + Clarity upgrade.
 * - `api_error`: Clarity upgrade only - the mutation transport already
 *   reports non-409 failures to Sentry, so re-reporting would duplicate.
 */
export async function executeReservationDecision(
  params: ExecuteReservationDecisionParams
): Promise<ReservationDecisionResult> {
  const {
    kind,
    reservation,
    myUserId,
    myRole,
    text,
    port = defaultReservationDecisionPort,
    telemetry,
  } = params;

  const validation = validateReservationDecisionText(kind, text);
  if (!validation.ok) {
    return {
      ok: false,
      kind,
      reason: 'invalid_input',
      message: validation.message,
    };
  }

  try {
    if (kind === 'accept') {
      await port.accept({
        message: validation.value,
        reservation,
        myUserId,
        myRole,
      });
    } else {
      await port.rejectOrCancel({
        text: validation.value,
        reservation,
        myUserId,
        myRole,
      });
    }

    return {
      ok: true,
      kind,
      text: validation.value,
      notice: RESERVATION_DECISION_SUCCESS_NOTICE[kind],
    };
  } catch (error) {
    safeEmit(
      () => telemetry?.upgradeClaritySession ?? upgradeClaritySession,
      RESERVATION_DECISION_CLARITY_REASON
    );

    if (isVersionConflict(error)) {
      safeEmit(() => telemetry?.captureFlowFailure ?? captureFlowFailure, {
        flow: MONITORING_FLOW_BY_KIND[kind],
        step: 'version_conflict',
        message: 'Reservation version conflict (409)',
        errorCode: 409,
        level: 'info',
      });
      return {
        ok: false,
        kind,
        reason: 'version_conflict',
        message: RESERVATION_CONFLICT_MESSAGE,
      };
    }

    return {
      ok: false,
      kind,
      reason: 'api_error',
      message: RESERVATION_DECISION_ERROR_COPY[kind],
    };
  }
}

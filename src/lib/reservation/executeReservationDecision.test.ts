import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import type { Reservation } from '@/types/reservation';

import {
  executeReservationDecision,
  isFailedReservationDecision,
  RESERVATION_DECISION_ERROR_COPY,
  RESERVATION_DECISION_SUCCESS_NOTICE,
  RESERVATION_REASON_REQUIRED_MESSAGE,
  type ReservationDecisionPort,
  validateReservationDecisionText,
} from './executeReservationDecision';

const reservation: Reservation = {
  id: 'res-977',
  name: 'Pat Partner',
  roleLine: 'Designer',
  date: '2026-08-01',
  time: '10:00 AM – 10:30 AM',
  messages: [],
  scheduleId: 977,
  dtstart: 1785600000,
  dtend: 1785601800,
  senderUserId: 'user-mentee',
  participantUserId: 'user-mentor',
  version: 3,
};

function makePort(): ReservationDecisionPort & {
  accept: ReturnType<typeof vi.fn>;
  rejectOrCancel: ReturnType<typeof vi.fn>;
} {
  return {
    accept: vi.fn().mockResolvedValue(undefined),
    rejectOrCancel: vi.fn().mockResolvedValue(undefined),
  };
}

function makeTelemetry() {
  return {
    captureFlowFailure: vi.fn(),
    upgradeClaritySession: vi.fn(),
  };
}

describe('executeReservationDecision architectural purity (#977)', () => {
  it('contains zero React, Next, hook, or component imports', () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/lib/reservation/executeReservationDecision.ts'
      ),
      'utf8'
    );
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*(import|export)\b.*from\s/.test(line));

    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]react/);
      expect(line).not.toMatch(/from\s+['"]next/);
      expect(line).not.toMatch(/from\s+['"]@\/hooks\//);
      expect(line).not.toMatch(/from\s+['"]@\/components\//);
    }
  });
});

describe('validateReservationDecisionText (#977)', () => {
  it('accepts an empty or whitespace-only quick reply and returns it trimmed', () => {
    expect(validateReservationDecisionText('accept', '')).toEqual({
      ok: true,
      value: '',
    });
    expect(validateReservationDecisionText('accept', '  見面聊！  ')).toEqual({
      ok: true,
      value: '見面聊！',
    });
  });

  it('rejects a quick reply over 500 characters with the shared quickReplyFormSchema message', () => {
    expect(validateReservationDecisionText('accept', 'A'.repeat(501))).toEqual({
      ok: false,
      message: '回覆訊息請勿超過 500 字',
    });
    expect(
      validateReservationDecisionText('accept', `  ${'A'.repeat(500)}  `)
    ).toEqual({ ok: true, value: 'A'.repeat(500) });
  });

  it.each(['reject', 'cancel'] as const)(
    'requires a non-blank %s reason and returns it trimmed',
    (kind) => {
      expect(validateReservationDecisionText(kind, '')).toEqual({
        ok: false,
        message: RESERVATION_REASON_REQUIRED_MESSAGE,
      });
      expect(validateReservationDecisionText(kind, '   ')).toEqual({
        ok: false,
        message: RESERVATION_REASON_REQUIRED_MESSAGE,
      });
      expect(validateReservationDecisionText(kind, ' 時段衝突 ')).toEqual({
        ok: true,
        value: '時段衝突',
      });
    }
  );
});

describe('executeReservationDecision (#977)', () => {
  let port: ReturnType<typeof makePort>;
  let telemetry: ReturnType<typeof makeTelemetry>;

  beforeEach(() => {
    port = makePort();
    telemetry = makeTelemetry();
  });

  it('accepts through the injected port with the trimmed quick reply and returns a named success with the accept notice', async () => {
    const result = await executeReservationDecision({
      kind: 'accept',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
      text: '  期待見面  ',
      port,
      telemetry,
    });

    expect(port.accept).toHaveBeenCalledTimes(1);
    expect(port.accept).toHaveBeenCalledWith({
      message: '期待見面',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
    });
    expect(port.rejectOrCancel).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      kind: 'accept',
      text: '期待見面',
      notice: {
        title: '已接受預約',
        description: '會議連結將於數分鐘內寄至雙方信箱',
      },
    });
    expect(telemetry.captureFlowFailure).not.toHaveBeenCalled();
    expect(telemetry.upgradeClaritySession).not.toHaveBeenCalled();
  });

  it.each([
    ['reject', '已拒絕預約'],
    ['cancel', '已取消預約'],
  ] as const)(
    'routes %s through port.rejectOrCancel with the trimmed reason and returns its notice',
    async (kind, description) => {
      const result = await executeReservationDecision({
        kind,
        reservation,
        myUserId: 'user-mentor',
        myRole: 'mentor',
        text: ' 臨時有事 ',
        port,
        telemetry,
      });

      expect(port.rejectOrCancel).toHaveBeenCalledWith({
        text: '臨時有事',
        reservation,
        myUserId: 'user-mentor',
        myRole: 'mentor',
      });
      expect(port.accept).not.toHaveBeenCalled();
      expect(result).toEqual({
        ok: true,
        kind,
        text: '臨時有事',
        notice: { description },
      });
      expect(RESERVATION_DECISION_SUCCESS_NOTICE[kind]).toEqual({
        description,
      });
    }
  );

  it('defaults the accept quick reply to an empty string when omitted', async () => {
    await executeReservationDecision({
      kind: 'accept',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
      port,
      telemetry,
    });

    expect(port.accept).toHaveBeenCalledWith(
      expect.objectContaining({ message: '' })
    );
  });

  it('returns invalid_input without calling the port when the reject/cancel reason is blank', async () => {
    const result = await executeReservationDecision({
      kind: 'cancel',
      reservation,
      myUserId: 'user-mentee',
      myRole: 'mentee',
      text: '   ',
      port,
      telemetry,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'cancel',
      reason: 'invalid_input',
      message: RESERVATION_REASON_REQUIRED_MESSAGE,
    });
    expect(port.rejectOrCancel).not.toHaveBeenCalled();
    expect(telemetry.captureFlowFailure).not.toHaveBeenCalled();
    expect(telemetry.upgradeClaritySession).not.toHaveBeenCalled();
  });

  it('returns invalid_input without calling the port when the quick reply exceeds 500 characters', async () => {
    const result = await executeReservationDecision({
      kind: 'accept',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
      text: 'B'.repeat(501),
      port,
      telemetry,
    });

    expect(result).toEqual({
      ok: false,
      kind: 'accept',
      reason: 'invalid_input',
      message: '回覆訊息請勿超過 500 字',
    });
    expect(port.accept).not.toHaveBeenCalled();
  });

  it.each(['accept', 'reject', 'cancel'] as const)(
    'classifies a %s ReservationVersionConflictError as version_conflict with info-level monitoring and a Clarity upgrade',
    async (kind) => {
      port.accept.mockRejectedValue(new ReservationVersionConflictError());
      port.rejectOrCancel.mockRejectedValue(
        new ReservationVersionConflictError()
      );

      const result = await executeReservationDecision({
        kind,
        reservation,
        myUserId: 'user-mentor',
        myRole: 'mentor',
        text: 'reason',
        port,
        telemetry,
      });

      expect(result).toEqual({
        ok: false,
        kind,
        reason: 'version_conflict',
        message: RESERVATION_CONFLICT_MESSAGE,
      });
      expect(telemetry.captureFlowFailure).toHaveBeenCalledTimes(1);
      expect(telemetry.captureFlowFailure).toHaveBeenCalledWith({
        flow: kind === 'accept' ? 'reservation_accept' : 'reservation_reject',
        step: 'version_conflict',
        message: 'Reservation version conflict (409)',
        errorCode: 409,
        level: 'info',
      });
      expect(telemetry.upgradeClaritySession).toHaveBeenCalledWith(
        'reservation_decision_failed'
      );
    }
  );

  it('also classifies a raw ApiError(409) from a custom port as version_conflict', async () => {
    port.rejectOrCancel.mockRejectedValue(
      new ApiError(409, 'Conflict', 'version_conflict')
    );

    const result = await executeReservationDecision({
      kind: 'reject',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
      text: 'reason',
      port,
      telemetry,
    });

    expect(result).toMatchObject({ ok: false, reason: 'version_conflict' });
  });

  it.each([
    ['accept', '接受預約失敗,請稍後再試'],
    ['reject', '拒絕預約失敗,請稍後再試'],
    ['cancel', '取消預約失敗,請稍後再試'],
  ] as const)(
    'classifies any other %s failure as api_error with the fallback copy, upgrading Clarity without re-reporting to Sentry',
    async (kind, message) => {
      port.accept.mockRejectedValue(new Error('network down'));
      port.rejectOrCancel.mockRejectedValue(new Error('network down'));

      const result = await executeReservationDecision({
        kind,
        reservation,
        myUserId: 'user-mentor',
        myRole: 'mentor',
        text: 'reason',
        port,
        telemetry,
      });

      expect(result).toEqual({
        ok: false,
        kind,
        reason: 'api_error',
        message,
      });
      expect(RESERVATION_DECISION_ERROR_COPY[kind]).toBe(message);
      // The write transport (reservationMutations) already reports non-409
      // failures to Sentry, so this module must not double-report them.
      expect(telemetry.captureFlowFailure).not.toHaveBeenCalled();
      expect(telemetry.upgradeClaritySession).toHaveBeenCalledWith(
        'reservation_decision_failed'
      );
    }
  );

  it('never throws, even when the port rejects with a non-Error value or myUserId is missing', async () => {
    port.accept.mockRejectedValue('boom');

    await expect(
      executeReservationDecision({
        kind: 'accept',
        reservation,
        myUserId: undefined,
        myRole: 'mentor',
        port,
        telemetry,
      })
    ).resolves.toMatchObject({ ok: false, reason: 'api_error' });
  });

  it('never forwards the free-text reason or reply to telemetry (zero PII)', async () => {
    port.rejectOrCancel.mockRejectedValue(
      new ReservationVersionConflictError()
    );

    await executeReservationDecision({
      kind: 'reject',
      reservation,
      myUserId: 'user-mentor',
      myRole: 'mentor',
      text: '私人原因 0912-345-678',
      port,
      telemetry,
    });

    const serialized = JSON.stringify([
      telemetry.captureFlowFailure.mock.calls,
      telemetry.upgradeClaritySession.mock.calls,
    ]);
    expect(serialized).not.toContain('私人原因');
    expect(serialized).not.toContain('0912');
    expect(serialized).not.toContain('Pat Partner');
  });
});

describe('isFailedReservationDecision (#977)', () => {
  it('only treats named { ok: false } results as failures', () => {
    expect(
      isFailedReservationDecision({
        ok: false,
        kind: 'reject',
        reason: 'api_error',
        message: 'x',
      })
    ).toBe(true);
    expect(
      isFailedReservationDecision({ ok: false, reason: 'in_flight' })
    ).toBe(true);
    expect(
      isFailedReservationDecision({
        ok: true,
        kind: 'reject',
        text: 'x',
        notice: { description: 'x' },
      })
    ).toBe(false);
    expect(isFailedReservationDecision(undefined)).toBe(false);
    expect(isFailedReservationDecision(null)).toBe(false);
    expect(isFailedReservationDecision('ok')).toBe(false);
  });
});

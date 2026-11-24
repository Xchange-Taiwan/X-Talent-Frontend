import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockToast, mockTrackEvent, mockUpgradeClaritySession } = vi.hoisted(
  () => ({
    mockToast: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockUpgradeClaritySession: vi.fn(),
  })
);

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
  upgradeClaritySession: mockUpgradeClaritySession,
}));

vi.mock('@/lib/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
  };
});

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    acceptReservation: vi.fn(),
    rejectOrCancelReservation: vi.fn(),
    submitReservationFeedback: vi.fn(),
    updateReservationFeedback: vi.fn(),
  };
});

import { captureFlowFailure } from '@/lib/monitoring';
import {
  acceptReservation,
  rejectOrCancelReservation,
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
  submitReservationFeedback,
  updateReservationFeedback,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

import { useReservationActions } from './useReservationActions';

const mockAcceptService = vi.mocked(acceptReservation);
const mockRejectService = vi.mocked(rejectOrCancelReservation);
const mockSubmitFeedbackService = vi.mocked(submitReservationFeedback);
const mockUpdateFeedbackService = vi.mocked(updateReservationFeedback);

const mockReservation: Reservation = {
  id: 'res-abc',
  name: 'Test Partner',
  roleLine: 'Designer',
  date: 'Mon, Jan 01, 2024',
  time: '10:00 am – 11:00 am',
  messages: [],
  scheduleId: 101,
  dtstart: 1700000000,
  dtend: 1700003600,
  senderUserId: 'user-123',
  participantUserId: 'user-456',
  version: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAcceptService.mockImplementation(async ({ myUserId }) => {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
  });
  mockRejectService.mockImplementation(async ({ myUserId }) => {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
  });
});

type HookProps = Parameters<typeof useReservationActions>[0];
type HookResult = ReturnType<typeof useReservationActions>;
type DecisionOutcome = Awaited<ReturnType<HookResult['accept']>>;

function renderActions(overrides: Partial<HookProps> = {}) {
  return renderHook(() =>
    useReservationActions({
      myUserId: 'user-123',
      variant: 'pending-mentor',
      myRole: 'mentor',
      ...overrides,
    })
  );
}

describe('useReservationActions', () => {
  const mockOnMutationSuccess = vi.fn();

  describe('accept (single adapter over executeReservationDecision, #977)', () => {
    it('calls acceptReservation, shows the success toast, runs onMutationSuccess, and resolves a named success result', async () => {
      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      expect(result.current.isMutating).toBe(false);

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.accept(mockReservation, 'hello message');
      });

      expect(mockAcceptService).toHaveBeenCalledTimes(1);
      expect(mockAcceptService).toHaveBeenCalledWith({
        message: 'hello message',
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentor',
      });
      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({
        title: '已接受預約',
        description: '會議連結將於數分鐘內寄至雙方信箱',
      });
      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc');
      expect(outcome).toMatchObject({ ok: true, kind: 'accept' });
      expect(result.current.isMutating).toBe(false);
    });

    it('sets isMutating to true while the accept request is in-flight', async () => {
      let resolveAccept: () => void = () => {};
      mockAcceptService.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveAccept = resolve;
        })
      );

      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      let promise: Promise<unknown> | undefined;
      await act(async () => {
        promise = result.current.accept(mockReservation, 'hello');
      });

      expect(result.current.isMutating).toBe(true);

      await act(async () => {
        resolveAccept();
        await promise;
      });

      expect(result.current.isMutating).toBe(false);
    });

    it('owns the destructive fallback toast on generic failure and resolves (never rejects) an api_error result', async () => {
      mockAcceptService.mockRejectedValue(new Error('API Accept Failed'));

      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.accept(mockReservation, 'hello');
      });

      expect(outcome).toEqual({
        ok: false,
        kind: 'accept',
        reason: 'api_error',
        message: '接受預約失敗,請稍後再試',
      });
      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: '接受預約失敗,請稍後再試',
      });
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
      expect(mockUpgradeClaritySession).toHaveBeenCalledWith(
        'reservation_decision_failed'
      );
      expect(result.current.isMutating).toBe(false);
    });

    it('owns the conflict toast on 409 ReservationVersionConflictError (no caller wrapper required)', async () => {
      mockAcceptService.mockRejectedValue(
        new ReservationVersionConflictError()
      );

      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.accept(mockReservation, 'hello');
      });

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'version_conflict',
      });
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: RESERVATION_CONFLICT_MESSAGE,
      });
      expect(vi.mocked(captureFlowFailure)).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'reservation_accept',
          step: 'version_conflict',
          level: 'info',
        })
      );
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
    });

    it('resolves api_error with the fallback toast when myUserId is missing', async () => {
      const { result } = renderActions({ myUserId: undefined });

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.accept(mockReservation, 'hello');
      });

      expect(outcome).toMatchObject({ ok: false, reason: 'api_error' });
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: '接受預約失敗,請稍後再試',
      });
    });

    it('rejects re-entry while a decision is in flight without a second write or toast', async () => {
      let resolveAccept: () => void = () => {};
      mockAcceptService.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveAccept = resolve;
        })
      );

      const { result } = renderActions();

      let first: Promise<unknown> | undefined;
      let second: DecisionOutcome | undefined;
      await act(async () => {
        first = result.current.accept(mockReservation, 'one');
        second = await result.current.accept(mockReservation, 'two');
      });

      expect(second).toEqual({ ok: false, reason: 'in_flight' });
      expect(mockAcceptService).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveAccept();
        await first;
      });
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    it('still resolves the success result when onMutationSuccess throws (the write already succeeded)', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const failingSuccess = vi.fn().mockRejectedValue(new Error('reload'));

      const { result } = renderActions({ onMutationSuccess: failingSuccess });

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.accept(mockReservation, '');
      });

      expect(outcome).toMatchObject({ ok: true });
      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(result.current.isMutating).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('rejectOrCancel (single adapter over executeReservationDecision, #977)', () => {
    it('calls rejectOrCancelReservation, shows the reject toast, and runs onMutationSuccess without a GA4 event (#950)', async () => {
      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.rejectOrCancel(
          mockReservation,
          'Reject reason text',
          'reject'
        );
      });

      expect(mockRejectService).toHaveBeenCalledTimes(1);
      expect(mockRejectService).toHaveBeenCalledWith({
        text: 'Reject reason text',
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentor',
      });
      expect(mockTrackEvent).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({ description: '已拒絕預約' });
      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc');
      expect(outcome).toMatchObject({ ok: true, kind: 'reject' });
      expect(result.current.isMutating).toBe(false);
    });

    it('shows the cancel toast without a redundant GA4 event when action is cancel (#950)', async () => {
      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      await act(async () => {
        await result.current.rejectOrCancel(
          mockReservation,
          'Cancel reason text',
          'cancel'
        );
      });

      expect(mockTrackEvent).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({ description: '已取消預約' });
    });

    it('sets isMutating to true while the rejectOrCancel request is in-flight', async () => {
      let resolveReject: () => void = () => {};
      mockRejectService.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveReject = resolve;
        })
      );

      const { result } = renderActions();

      let promise: Promise<unknown> | undefined;
      await act(async () => {
        promise = result.current.rejectOrCancel(
          mockReservation,
          'reason text',
          'reject'
        );
      });

      expect(result.current.isMutating).toBe(true);

      await act(async () => {
        resolveReject();
        await promise;
      });

      expect(result.current.isMutating).toBe(false);
    });

    it.each([
      ['reject', '拒絕預約失敗,請稍後再試'],
      ['cancel', '取消預約失敗,請稍後再試'],
    ] as const)(
      'owns the %s fallback toast on generic failure and keeps onMutationSuccess untouched',
      async (action, description) => {
        mockRejectService.mockRejectedValue(new Error('API Reject Failed'));

        const { result } = renderActions({
          onMutationSuccess: mockOnMutationSuccess,
        });

        let outcome: DecisionOutcome | undefined;
        await act(async () => {
          outcome = await result.current.rejectOrCancel(
            mockReservation,
            'reason',
            action
          );
        });

        expect(outcome).toMatchObject({ ok: false, reason: 'api_error' });
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          description,
        });
        expect(mockOnMutationSuccess).not.toHaveBeenCalled();
        expect(result.current.isMutating).toBe(false);
      }
    );

    it('owns the conflict toast on 409 ReservationVersionConflictError', async () => {
      mockRejectService.mockRejectedValue(
        new ReservationVersionConflictError()
      );

      const { result } = renderActions({
        onMutationSuccess: mockOnMutationSuccess,
      });

      await act(async () => {
        await result.current.rejectOrCancel(
          mockReservation,
          'reason',
          'reject'
        );
      });

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: RESERVATION_CONFLICT_MESSAGE,
      });
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
    });

    it('blocks a blank reason before any write and surfaces the validation toast', async () => {
      const { result } = renderActions();

      let outcome: DecisionOutcome | undefined;
      await act(async () => {
        outcome = await result.current.rejectOrCancel(
          mockReservation,
          '   ',
          'cancel'
        );
      });

      expect(outcome).toMatchObject({ ok: false, reason: 'invalid_input' });
      expect(mockRejectService).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: '請輸入原因',
      });
    });
  });

  describe('submitFeedback (#730)', () => {
    it('calls submitReservationFeedback, tracks analytics without PII, and triggers onMutationSuccess', async () => {
      mockSubmitFeedbackService.mockResolvedValueOnce();

      const { result } = renderActions({
        variant: 'history',
        myRole: 'mentee',
        onMutationSuccess: mockOnMutationSuccess,
      });

      await act(async () => {
        await result.current.submitFeedback(mockReservation, {
          meeting_happened: true,
          feedback: { rating: 10, content: '收穫良多' },
        });
      });

      expect(mockSubmitFeedbackService).toHaveBeenCalledWith({
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentee',
        payload: {
          meeting_happened: true,
          feedback: { rating: 10, content: '收穫良多' },
        },
      });
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'reservation_feedback_submitted',
        feature: 'reservation',
        metadata: { meeting_happened: true },
      });
      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc');
    });

    it('still rethrows feedback failures so useMeetingFeedbackForm can classify them', async () => {
      mockSubmitFeedbackService.mockRejectedValueOnce(
        new ReservationVersionConflictError()
      );
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderActions({
        variant: 'history',
        myRole: 'mentee',
      });

      await expect(
        act(async () => {
          await result.current.submitFeedback(mockReservation, {
            meeting_happened: true,
          });
        })
      ).rejects.toBeInstanceOf(ReservationVersionConflictError);
      expect(mockToast).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('updateFeedback (#731, #950)', () => {
    it('calls updateReservationFeedback without redundant GA4 event or PII, and triggers onMutationSuccess', async () => {
      mockUpdateFeedbackService.mockResolvedValueOnce();

      const { result } = renderActions({
        variant: 'history',
        myRole: 'mentee',
        onMutationSuccess: mockOnMutationSuccess,
      });

      await act(async () => {
        await result.current.updateFeedback(mockReservation, {
          rating: 8,
          content: '更新後的回饋內容',
        });
      });

      expect(mockUpdateFeedbackService).toHaveBeenCalledWith({
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentee',
        payload: {
          rating: 8,
          content: '更新後的回饋內容',
        },
      });
      expect(mockTrackEvent).not.toHaveBeenCalled();
      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc');
    });
  });
});

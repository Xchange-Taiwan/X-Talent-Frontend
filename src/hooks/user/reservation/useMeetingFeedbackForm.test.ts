import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: vi.fn(),
  }),
}));

import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import type { Reservation } from '@/types/reservation';

import { QUEUE_PROMOTE_MS, QUEUE_SWIPE_OUT_MS } from './useFeedbackQueueMotion';
import {
  buildCreateInitialValues,
  buildEditBaseValues,
  DEFAULT_MEETING_FEEDBACK_FORM_VALUES,
  useMeetingFeedbackController,
  useMeetingFeedbackForm,
} from './useMeetingFeedbackForm';

describe('useMeetingFeedbackForm', () => {
  it('initializes with null attendance, default rating 10, empty content, and empty not-happened fields', () => {
    const { result } = renderHook(() => useMeetingFeedbackForm());

    expect(result.current.getValues()).toEqual(
      DEFAULT_MEETING_FEEDBACK_FORM_VALUES
    );
    expect(result.current.getValues('rating')).toBe(10);
  });

  it('updates values cleanly via setValue', async () => {
    const { result } = renderHook(() => useMeetingFeedbackForm());

    await act(async () => {
      result.current.setValue('meetingHappened', true, {
        shouldValidate: true,
      });
      result.current.setValue('rating', 8, { shouldValidate: true });
      result.current.setValue('content', '收穫滿滿', { shouldValidate: true });
    });

    expect(result.current.getValues()).toEqual({
      meetingHappened: true,
      rating: 8,
      content: '收穫滿滿',
      notHappenedReason: null,
      notHappenedNote: '',
    });
  });

  it('initializes with prefilled rating and content when provided for edit mode (#731)', () => {
    const { result } = renderHook(() =>
      useMeetingFeedbackForm({
        meetingHappened: true,
        rating: 7,
        content: '原本已送出的評論',
        notHappenedReason: null,
        notHappenedNote: '',
      })
    );

    expect(result.current.getValues()).toEqual({
      meetingHappened: true,
      rating: 7,
      content: '原本已送出的評論',
      notHappenedReason: null,
      notHappenedNote: '',
    });
  });
});

describe('useMeetingFeedbackController', () => {
  const baseReservation = fromPartial<Reservation>({
    id: 'ctrl-res-1',
    name: 'Emily Chen',
    date: '2026/10/20',
    time: '19:00–19:30',
    viewerRole: 'MENTEE',
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates create and edit baselines cleanly and re-syncs closed edit mode when saved rating updates (#731)', () => {
    expect(buildCreateInitialValues('rating', 9, '預設文字')).toEqual({
      meetingHappened: true,
      rating: 9,
      content: '預設文字',
      notHappenedReason: null,
      notHappenedNote: '',
    });

    const initialEditRes = fromPartial<Reservation>({
      ...baseReservation,
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 7,
          content: '第一版評論',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    expect(buildEditBaseValues(initialEditRes)).toEqual({
      meetingHappened: true,
      rating: 7,
      content: '第一版評論',
      notHappenedReason: null,
      notHappenedNote: '',
    });

    const { result, rerender } = renderHook(
      ({ reservation }) =>
        useMeetingFeedbackController({
          mode: 'edit',
          defaultOpen: false,
          reservation,
        }),
      {
        initialProps: { reservation: initialEditRes },
      }
    );

    expect(result.current.effectiveStep).toBe('rating');
    expect(result.current.values.rating).toBe(7);
    expect(result.current.values.content).toBe('第一版評論');
    expect(result.current.footerModel.primaryAction.label).toBe('儲存');

    // Update saved rating while closed -> automatically re-hydrates RHF baseline
    const updatedEditRes = fromPartial<Reservation>({
      ...baseReservation,
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 9,
          content: '外部更新後的第二版評論',
          createdAt: 1760000000,
          updatedAt: 1760000100,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    rerender({ reservation: updatedEditRes });

    expect(result.current.values.rating).toBe(9);
    expect(result.current.values.content).toBe('外部更新後的第二版評論');
  });

  it('distinguishes single-card X skip from Escape/backdrop batch skipRemainingQueue (#906)', () => {
    vi.useFakeTimers();

    const item1 = fromPartial<Reservation>({
      ...baseReservation,
      id: 'q-1',
      name: 'Emily',
    });
    const item2 = fromPartial<Reservation>({
      ...baseReservation,
      id: 'q-2',
      name: 'Alex',
    });
    const item3 = fromPartial<Reservation>({
      ...baseReservation,
      id: 'q-3',
      name: 'Sarah',
    });
    const onSkipReservation = vi.fn();
    const onClose = vi.fn();

    try {
      const { result } = renderHook(() =>
        useMeetingFeedbackController({
          defaultOpen: true,
          reservation: item1,
          queue: [item1, item2, item3],
          onSkipReservation,
          onClose,
        })
      );

      // Single-card X skip skips ONLY item1 and advances to item2
      act(() => {
        result.current.handleCloseOrSkipClick();
        vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
      });

      expect(onSkipReservation.mock.calls.map(([r]) => r.id)).toEqual(['q-1']);
      expect(result.current.activeReservation.id).toBe('q-2');
      expect(result.current.open).toBe(true);

      // Escape / backdrop close (handleOpenChange(false)) skips remaining [q-2, q-3] and closes
      act(() => {
        result.current.handleOpenChange(false);
      });

      expect(onSkipReservation.mock.calls.map(([r]) => r.id)).toEqual([
        'q-1',
        'q-2',
        'q-3',
      ]);
      expect(result.current.open).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enforces inFlightRef locking, retains draft on generic error, and resets + closes on 409 ReservationVersionConflictError', async () => {
    let rejectFirst: (err: unknown) => void = () => {};
    const firstAttempt = new Promise<void>((_, reject) => {
      rejectFirst = reject;
    });

    const onSubmitFeedback = vi
      .fn()
      .mockReturnValueOnce(firstAttempt)
      .mockRejectedValueOnce(new ReservationVersionConflictError());
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useMeetingFeedbackController({
        defaultOpen: true,
        initialStep: 'rating',
        initialRating: 8,
        initialContent: '重要回饋草稿',
        reservation: baseReservation,
        onSubmitFeedback,
        onClose,
      })
    );

    // Trigger submit twice while first request is in-flight -> locked to 1 call
    let submitPromise1!: Promise<void>;
    await act(async () => {
      submitPromise1 = result.current.handleFormSubmit();
      void result.current.handleFormSubmit();
      await Promise.resolve();
    });

    expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);

    // Closing while in-flight is ignored
    act(() => {
      result.current.handleOpenChange(false);
    });
    expect(result.current.open).toBe(true);

    // Generic error retains open state and draft
    await act(async () => {
      rejectFirst(new Error('Network down'));
      await submitPromise1;
    });

    expect(result.current.open).toBe(true);
    expect(result.current.values.rating).toBe(8);
    expect(result.current.values.content).toBe('重要回饋草稿');
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '送出失敗',
      description: '內容已保留，請再試一次。',
    });

    // Mutate draft then hit 409 conflict -> resets draft to base and closes dialog
    act(() => {
      result.current.handleRatingChange(4);
    });
    expect(result.current.values.rating).toBe(4);

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.values.rating).toBe(8);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenLastCalledWith({
      variant: 'destructive',
      description: RESERVATION_CONFLICT_MESSAGE,
    });
  });

  it('dismisses open tooltip first on Escape before allowing dialog close', () => {
    const { result } = renderHook(() =>
      useMeetingFeedbackController({
        defaultOpen: true,
        initialStep: 'rating',
        reservation: baseReservation,
      })
    );

    act(() => {
      result.current.setIsMaskTooltipOpen(true);
    });

    const preventDefault1 = vi.fn();
    act(() => {
      result.current.handleEscapeKeyDown(
        fromPartial<KeyboardEvent>({ preventDefault: preventDefault1 })
      );
    });

    expect(preventDefault1).toHaveBeenCalledTimes(1);
    expect(result.current.tooltipDismissSignal).toBe(1);

    // Subsequent Escape does not prevent default so Radix Dialog can close
    const preventDefault2 = vi.fn();
    act(() => {
      result.current.handleEscapeKeyDown(
        fromPartial<KeyboardEvent>({ preventDefault: preventDefault2 })
      );
    });
    expect(preventDefault2).not.toHaveBeenCalled();
  });

  it('orchestrates edit-mode PUT error retention, 409 conflict reset, and Mentor 1-step attendance submission', async () => {
    const ratedReservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'edit-res-933',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 7,
          content: '初始內容',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    const onUpdateFeedback = vi
      .fn()
      .mockRejectedValueOnce(new Error('PUT failed'))
      .mockRejectedValueOnce(new ReservationVersionConflictError());

    const { result } = renderHook(() =>
      useMeetingFeedbackController({
        mode: 'edit',
        defaultOpen: true,
        reservation: ratedReservation,
        onUpdateFeedback,
      })
    );

    act(() => {
      result.current.handleRatingChange(9);
    });

    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.values.rating).toBe(9);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '儲存失敗',
      description: '內容已保留，請再試一次。',
    });

    // Second attempt hits 409 -> resets back to saved rating 7 and closes
    await act(async () => {
      await result.current.handleFormSubmit();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.values.rating).toBe(7);

    // Mentor 1-step happened submits { meeting_happened: true } directly
    const onSubmitMentor = vi.fn().mockResolvedValue(undefined);
    const mentorRes = fromPartial<Reservation>({
      ...baseReservation,
      id: 'mentor-res-933',
      viewerRole: 'MENTOR',
    });

    const { result: mentorCtrl } = renderHook(() =>
      useMeetingFeedbackController({
        defaultOpen: true,
        reservation: mentorRes,
        onSubmitFeedback: onSubmitMentor,
      })
    );

    expect(mentorCtrl.current.isMentor).toBe(true);
    expect(mentorCtrl.current.footerModel.primaryAction.label).toBe('確定送出');
    expect(mentorCtrl.current.footerModel.primaryAction.disabled).toBe(true);

    act(() => {
      mentorCtrl.current.handleSelectMeetingHappened(true);
    });
    expect(mentorCtrl.current.footerModel.primaryAction.type).toBe('submit');
    expect(mentorCtrl.current.footerModel.primaryAction.disabled).toBe(false);

    await act(async () => {
      await mentorCtrl.current.handleFormSubmit();
    });

    expect(onSubmitMentor).toHaveBeenCalledWith(
      { meeting_happened: true },
      mentorRes
    );
    expect(mentorCtrl.current.open).toBe(false);
  });
});

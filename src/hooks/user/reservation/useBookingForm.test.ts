import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/services/reservations', () => ({
  createReservation: vi.fn(),
}));

import { ApiError } from '@/lib/apiClient';
import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import { createReservation } from '@/services/reservations';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';
import type { components } from '@/types/api';

import { useBookingForm } from './useBookingForm';

const mockCreateReservation = vi.mocked(createReservation);

describe('useBookingForm', () => {
  const mockSlot: BookingSlot = {
    scheduleId: 456,
    start: new Date('2026-07-26T14:00:00Z'),
    end: new Date('2026-07-26T15:00:00Z'),
    isBooked: false,
    status: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates bookingQuestion against bookingFormSchema via zodResolver', async () => {
    const { result } = renderHook(() => {
      const bookingForm = useBookingForm();
      // Subscribe to RHF Proxy errors during render just like MenteeBookingForm does
      void bookingForm.formState.errors;
      return bookingForm;
    });

    await act(async () => {
      result.current.setValue('bookingQuestion', 'a'.repeat(1001), {
        shouldValidate: true,
      });
    });

    expect(result.current.formState.errors.bookingQuestion?.message).toBe(
      '問題字數請勿超過 1000 字'
    );
  });

  it('redirects to /auth/signin and returns false when loginUserId is missing', async () => {
    const setSelectedSlot = vi.fn();
    const { result } = renderHook(() =>
      useBookingForm({
        loginUserId: null,
        mentorId: 123,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitBooking('some question');
    });

    expect(ok).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    expect(mockCreateReservation).not.toHaveBeenCalled();
    expect(setSelectedSlot).not.toHaveBeenCalled();
  });

  it('returns false without toast or redirect when selectedSlot or mentorId is missing', async () => {
    const { result: missingSlot } = renderHook(() =>
      useBookingForm({
        loginUserId: '999',
        mentorId: 123,
        selectedSlot: null,
      })
    );

    let okSlot: boolean | undefined;
    await act(async () => {
      okSlot = await missingSlot.current.submitBooking('Hello');
    });
    expect(okSlot).toBe(false);

    const { result: missingMentor } = renderHook(() =>
      useBookingForm({
        loginUserId: '999',
        mentorId: undefined,
        selectedSlot: mockSlot,
      })
    );

    let okMentor: boolean | undefined;
    await act(async () => {
      okMentor = await missingMentor.current.submitBooking('Hello');
    });
    expect(okMentor).toBe(false);

    expect(mockCreateReservation).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('tracks isSubmitting, shows confirmation toast, resets form, clears selectedSlot, and triggers onMutationSuccess on success', async () => {
    const setSelectedSlot = vi.fn();
    const onMutationSuccess = vi.fn().mockResolvedValue(undefined);
    let resolveRequest!: (val: components['schemas']['ReservationVO']) => void;
    mockCreateReservation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const { result } = renderHook(() =>
      useBookingForm({
        loginUserId: '999',
        mentorId: 123,
        selectedSlot: mockSlot,
        setSelectedSlot,
        onMutationSuccess,
      })
    );

    await act(async () => {
      result.current.setValue('bookingQuestion', 'Hello mentor!');
    });

    let pendingPromise!: Promise<boolean>;
    act(() => {
      pendingPromise = result.current.submitBooking('Hello mentor!');
    });

    expect(result.current.isSubmitting).toBe(true);

    let ok: boolean | undefined;
    await act(async () => {
      resolveRequest({} as unknown as components['schemas']['ReservationVO']);
      ok = await pendingPromise;
    });

    expect(ok).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約已送出，等待導師回復',
      description: '導師接受後預約才會成立，可至「我的預約」追蹤狀態。',
    });
    expect(setSelectedSlot).toHaveBeenCalledWith(null);
    expect(result.current.getValues('bookingQuestion')).toBe('');
    expect(onMutationSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows slot-conflict destructive toast on ApiError(409) without resetting form or clearing slot', async () => {
    const setSelectedSlot = vi.fn();
    mockCreateReservation.mockRejectedValue(
      new ApiError(409, 'Conflict booking')
    );

    const { result } = renderHook(() =>
      useBookingForm({
        loginUserId: '999',
        mentorId: 123,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    await act(async () => {
      result.current.setValue('bookingQuestion', 'Keep my text');
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitBooking('Keep my text');
    });

    expect(ok).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約時間重疊',
      description: '該時段您已有其他預約，請重新選擇其他時段。',
      variant: 'destructive',
    });
    expect(setSelectedSlot).not.toHaveBeenCalled();
    expect(result.current.getValues('bookingQuestion')).toBe('Keep my text');
  });

  it('shows generic destructive toast on non-409 API errors without clearing slot', async () => {
    const setSelectedSlot = vi.fn();
    mockCreateReservation.mockRejectedValue(new Error('Server Crashed'));

    const { result } = renderHook(() =>
      useBookingForm({
        loginUserId: '999',
        mentorId: 123,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submitBooking('Hello');
    });

    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約失敗',
      description: 'Server Crashed',
      variant: 'destructive',
    });
    expect(setSelectedSlot).not.toHaveBeenCalled();
  });
});

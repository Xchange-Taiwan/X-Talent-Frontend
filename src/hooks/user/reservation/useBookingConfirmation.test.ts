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

import { BookingSlot } from '@/hooks/useMentorSchedule';
import { trackEvent } from '@/lib/analytics';
import { FetchApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { createReservation } from '@/services/reservations';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useBookingConfirmation } from './useBookingConfirmation';

const mockCreateReservation = vi.mocked(createReservation);
const mockTrackEvent = vi.mocked(trackEvent);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

describe('useBookingConfirmation', () => {
  const mockUserData = {
    user_id: 123,
    is_mentor: true,
  } as any;

  const mockSlot: BookingSlot = {
    scheduleId: 456,
    start: new Date('2026-07-26T14:00:00Z'),
    end: new Date('2026-07-26T15:00:00Z'),
    isBooked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to sign-in page and return false if loginUserId is missing', async () => {
    const setSelectedSlot = vi.fn();
    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: null,
        userData: mockUserData,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation('some question');
    });

    expect(res).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('should return false if selectedSlot is missing', async () => {
    const setSelectedSlot = vi.fn();
    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: '999',
        userData: mockUserData,
        selectedSlot: null,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation('some question');
    });

    expect(res).toBe(false);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('should return false if userData is missing', async () => {
    const setSelectedSlot = vi.fn();
    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: '999',
        userData: undefined,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation('some question');
    });

    expect(res).toBe(false);
    expect(mockCreateReservation).not.toHaveBeenCalled();
  });

  it('should successfully book a reservation and clean up states', async () => {
    const setSelectedSlot = vi.fn();
    mockCreateReservation.mockResolvedValue({} as any);

    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: '999',
        userData: mockUserData,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation(
        'Hello mentor, please help!'
      );
    });

    expect(res).toBe(true);
    expect(mockCreateReservation).toHaveBeenCalledWith({
      userId: 999,
      body: {
        my_user_id: 999,
        my_status: 'PENDING',
        user_id: 123,
        schedule_id: 456,
        dtstart: Math.floor(mockSlot.start.getTime() / 1000),
        dtend: Math.floor(mockSlot.end.getTime() / 1000),
        messages: [{ user_id: 999, content: 'Hello mentor, please help!' }],
      },
      debug: false,
    });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'reservation_booking_confirmed',
      feature: 'reservation',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約已送出，等待導師回復',
      description: '導師接受後預約才會成立，可至「我的預約」追蹤狀態。',
    });
    expect(setSelectedSlot).toHaveBeenCalledWith(null);
  });

  it('should handle standard errors by logging flow failure and showing failure toast', async () => {
    const setSelectedSlot = vi.fn();
    const err = new Error('Server Crashed');
    mockCreateReservation.mockRejectedValue(err);

    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: '999',
        userData: mockUserData,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation('Hello');
    });

    expect(res).toBe(false);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'reservation_create',
      step: 'create_reservation',
      message: 'Server Crashed',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約失敗',
      description: 'Server Crashed',
      variant: 'destructive',
    });
    expect(setSelectedSlot).not.toHaveBeenCalled();
  });

  it('should handle 409 Conflict duplicate error structurally and show conflict toast', async () => {
    const setSelectedSlot = vi.fn();
    const conflictError = new FetchApiError(
      '409',
      'Conflict booking',
      '/v1/users/999/reservations'
    );
    mockCreateReservation.mockRejectedValue(conflictError);

    const { result } = renderHook(() =>
      useBookingConfirmation({
        loginUserId: '999',
        userData: mockUserData,
        selectedSlot: mockSlot,
        setSelectedSlot,
      })
    );

    let res: boolean | undefined;
    await act(async () => {
      res = await result.current.handleConfirmReservation('Hello');
    });

    expect(res).toBe(false);
    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'reservation_create',
      step: 'create_reservation',
      message: conflictError.message,
      level: 'info',
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: '預約時間重疊',
      description: '該時段您已有其他預約，請重新選擇其他時段。',
      variant: 'destructive',
    });
    expect(setSelectedSlot).not.toHaveBeenCalled();
  });
});

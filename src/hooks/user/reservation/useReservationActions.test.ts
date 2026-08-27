import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockToast, mockTrackEvent } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    acceptReservation: vi.fn(),
    rejectOrCancelReservation: vi.fn(),
  };
});

import {
  acceptReservation,
  rejectOrCancelReservation,
  ReservationVersionConflictError,
} from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

import {
  buildRejectOrCancelAffectedTabs,
  useReservationActions,
} from './useReservationActions';

const mockAcceptService = vi.mocked(acceptReservation);
const mockRejectService = vi.mocked(rejectOrCancelReservation);

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

describe('buildRejectOrCancelAffectedTabs', () => {
  it('should return upcoming as source and history as destination for upcoming variant', () => {
    expect(buildRejectOrCancelAffectedTabs('upcoming')).toEqual({
      source: 'upcoming',
      destinations: ['history'],
    });
  });

  it('should return pending as source and history as destination for pending-mentor variant', () => {
    expect(buildRejectOrCancelAffectedTabs('pending-mentor')).toEqual({
      source: 'pending',
      destinations: ['history'],
    });
  });

  it('should return pending as source and history as destination for pending-mentee variant', () => {
    expect(buildRejectOrCancelAffectedTabs('pending-mentee')).toEqual({
      source: 'pending',
      destinations: ['history'],
    });
  });

  it('should return null for history variant', () => {
    expect(buildRejectOrCancelAffectedTabs('history')).toBeNull();
  });
});

describe('useReservationActions', () => {
  const mockOnMutationSuccess = vi.fn();

  describe('accept', () => {
    it('should set isMutating, call acceptReservation service, trigger toast and onMutationSuccess on success', async () => {
      mockAcceptService.mockResolvedValue();

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      expect(result.current.isMutating).toBe(false);

      let promise;
      await act(async () => {
        promise = result.current.accept(mockReservation, 'hello message');
      });

      await promise;

      expect(mockAcceptService).toHaveBeenCalledTimes(1);
      expect(mockAcceptService).toHaveBeenCalledWith({
        message: 'hello message',
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentor',
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: '已接受預約',
        description: '會議連結將於數分鐘內寄至雙方信箱',
      });

      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
        source: 'pending',
        destinations: ['upcoming'],
      });
      expect(result.current.isMutating).toBe(false);
    });

    it('should set isMutating to true while the accept request is in-flight', async () => {
      let resolveAccept: () => void = () => {};
      const acceptPromise = new Promise<void>((resolve) => {
        resolveAccept = resolve;
      });
      mockAcceptService.mockReturnValue(acceptPromise);

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      expect(result.current.isMutating).toBe(false);

      let promise;
      await act(async () => {
        promise = result.current.accept(mockReservation, 'hello');
      });

      expect(result.current.isMutating).toBe(true);

      await act(async () => {
        resolveAccept();
      });
      await promise;

      expect(result.current.isMutating).toBe(false);
    });

    it('should throw error and reset isMutating if service fails (toast is owned by the confirm dialog, not this hook)', async () => {
      const apiError = new Error('API Accept Failed');
      mockAcceptService.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      await expect(
        act(async () => {
          await result.current.accept(mockReservation, 'hello');
        })
      ).rejects.toThrow('API Accept Failed');

      expect(mockToast).not.toHaveBeenCalled();
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
      expect(result.current.isMutating).toBe(false);
    });

    it('should throw if myUserId is missing', async () => {
      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: undefined,
          variant: 'pending-mentor',
          myRole: 'mentor',
        })
      );

      await expect(
        act(async () => {
          await result.current.accept(mockReservation, 'hello');
        })
      ).rejects.toThrow('[reservationMutations] missing current user id');
    });

    it('should call onVersionConflict exactly once on 409 (toast is owned by the confirm dialog, not this hook)', async () => {
      mockAcceptService.mockRejectedValue(
        new ReservationVersionConflictError()
      );
      const mockOnVersionConflict = vi.fn();

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
          onVersionConflict: mockOnVersionConflict,
        })
      );

      await expect(
        act(async () => {
          await result.current.accept(mockReservation, 'hello');
        })
      ).rejects.toBeInstanceOf(ReservationVersionConflictError);

      expect(mockOnVersionConflict).toHaveBeenCalledTimes(1);
      expect(mockOnVersionConflict).toHaveBeenCalledWith({
        source: 'pending',
        destinations: ['upcoming'],
      });
      expect(mockToast).not.toHaveBeenCalled();
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
    });
  });

  describe('rejectOrCancel', () => {
    it('should set isMutating, call rejectOrCancelReservation, trigger success toast, onMutationSuccess, and track event', async () => {
      mockRejectService.mockResolvedValue();

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      let promise;
      await act(async () => {
        promise = result.current.rejectOrCancel(
          mockReservation,
          'Reject reason text',
          'reject'
        );
      });

      await promise;

      expect(mockRejectService).toHaveBeenCalledTimes(1);
      expect(mockRejectService).toHaveBeenCalledWith({
        text: 'Reject reason text',
        reservation: mockReservation,
        myUserId: 'user-123',
        myRole: 'mentor',
      });

      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'reservation_rejected',
        feature: 'reservation',
      });

      expect(mockToast).toHaveBeenCalledWith({
        description: '已拒絕預約',
      });

      expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
        source: 'pending',
        destinations: ['history'],
      });
      expect(result.current.isMutating).toBe(false);
    });

    it('should trigger correct cancel success toast when action is cancel', async () => {
      mockRejectService.mockResolvedValue();

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      let promise;
      await act(async () => {
        promise = result.current.rejectOrCancel(
          mockReservation,
          'Cancel reason text',
          'cancel'
        );
      });

      await promise;

      expect(mockToast).toHaveBeenCalledWith({
        description: '已取消預約',
      });
    });

    it('should set isMutating to true while the rejectOrCancel request is in-flight', async () => {
      let resolveReject: () => void = () => {};
      const rejectPromise = new Promise<void>((resolve) => {
        resolveReject = resolve;
      });
      mockRejectService.mockReturnValue(rejectPromise);

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      expect(result.current.isMutating).toBe(false);

      let promise;
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
      });
      await promise;

      expect(result.current.isMutating).toBe(false);
    });

    it('should throw error and reset isMutating if rejectOrCancel fails (toast is owned by the confirm dialog, not this hook)', async () => {
      const apiError = new Error('API Reject Failed');
      mockRejectService.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
        })
      );

      await expect(
        act(async () => {
          await result.current.rejectOrCancel(
            mockReservation,
            'reason',
            'reject'
          );
        })
      ).rejects.toThrow('API Reject Failed');

      expect(mockToast).not.toHaveBeenCalled();
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
      expect(result.current.isMutating).toBe(false);
    });

    it('should throw if myUserId is missing', async () => {
      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: undefined,
          variant: 'pending-mentor',
          myRole: 'mentor',
        })
      );

      await expect(
        act(async () => {
          await result.current.rejectOrCancel(
            mockReservation,
            'reason',
            'cancel'
          );
        })
      ).rejects.toThrow('[reservationMutations] missing current user id');
    });

    it('should call onVersionConflict exactly once on 409 (toast is owned by the confirm dialog, not this hook)', async () => {
      mockRejectService.mockRejectedValue(
        new ReservationVersionConflictError()
      );
      const mockOnVersionConflict = vi.fn();

      const { result } = renderHook(() =>
        useReservationActions({
          myUserId: 'user-123',
          variant: 'pending-mentor',
          myRole: 'mentor',
          onMutationSuccess: mockOnMutationSuccess,
          onVersionConflict: mockOnVersionConflict,
        })
      );

      await expect(
        act(async () => {
          await result.current.rejectOrCancel(
            mockReservation,
            'reason',
            'reject'
          );
        })
      ).rejects.toBeInstanceOf(ReservationVersionConflictError);

      expect(mockOnVersionConflict).toHaveBeenCalledTimes(1);
      expect(mockOnVersionConflict).toHaveBeenCalledWith({
        source: 'pending',
        destinations: ['history'],
      });
      expect(mockToast).not.toHaveBeenCalled();
      expect(mockOnMutationSuccess).not.toHaveBeenCalled();
    });
  });
});

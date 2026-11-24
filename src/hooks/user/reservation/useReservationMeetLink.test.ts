import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';
import { mockToast } from '@/test/mocks/useToast';

import { useReservationMeetLink } from './useReservationMeetLink';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

const mockTrackEvent = vi.fn();
const mockUpgradeClaritySession = vi.fn();
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
    upgradeClaritySession: (...args: unknown[]) =>
      mockUpgradeClaritySession(...args),
  };
});

vi.mock('@/services/reservations', () => ({
  fetchReservationMeetLink: vi.fn(),
}));

// Thin-adapter coverage only. The full join matrix (unsafe URLs, popup
// blocking, 403 / 404 / generic failures, single-flight lock) lives in
// src/lib/reservation/joinReservationMeet.test.ts.
describe('useReservationMeetLink', () => {
  let originalWindowOpen: typeof window.open;
  const mockWindowOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalWindowOpen = window.open;
    window.open = mockWindowOpen;
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  it('keeps the { joinMeet, isPending } signature', () => {
    const { result } = renderHook(() => useReservationMeetLink());
    expect(Object.keys(result.current).sort()).toEqual([
      'isPending',
      'joinMeet',
    ]);
    expect(result.current.isPending).toBe(false);
  });

  it('toasts the unauthenticated copy without opening a tab when myUserId is missing', async () => {
    const { result } = renderHook(() => useReservationMeetLink({}));

    await act(() => result.current.joinMeet('res-123'));

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '錯誤',
      description: '無法取得目前使用者資訊，請重新登入。',
    });
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('navigates the pre-opened tab and does not toast on success', async () => {
    const mockLocation = { href: '' };
    mockWindowOpen.mockReturnValue({ location: mockLocation, close: vi.fn() });
    vi.mocked(fetchReservationMeetLink).mockResolvedValue({
      meet_url: 'https://meet.google.com/abc-defg-hij',
    });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    await act(() => result.current.joinMeet('res-123'));

    expect(mockWindowOpen).toHaveBeenCalledWith('about:blank', '_blank');
    expect(fetchReservationMeetLink).toHaveBeenCalledWith({
      userId: 'user-456',
      reservationId: 'res-123',
    });
    expect(mockLocation.href).toBe('https://meet.google.com/abc-defg-hij');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('maps a failed join onto a destructive toast and upgrades Clarity without GA4 noise (#950)', async () => {
    const mockClose = vi.fn();
    mockWindowOpen.mockReturnValue({
      location: { href: '' },
      close: mockClose,
    });
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(
      new ApiError(403, 'forbidden')
    );

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    await act(() => result.current.joinMeet('res-123'));

    expect(mockClose).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '錯誤',
      description: '您並非此預約的導師或學員，無法加入。',
    });
    expect(mockUpgradeClaritySession).toHaveBeenCalledWith(
      'meet_link_fetch_failed'
    );
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('exposes isPending while in flight and opens only one tab on a rapid double click', async () => {
    let resolveFetch!: (value: { meet_url: string }) => void;
    vi.mocked(fetchReservationMeetLink).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const mockLocation = { href: '' };
    mockWindowOpen.mockReturnValue({ location: mockLocation, close: vi.fn() });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.joinMeet('res-123');
      second = result.current.joinMeet('res-123');
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await second;
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(fetchReservationMeetLink).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ meet_url: 'https://meet.google.com/abc-defg-hij' });
      await first;
    });

    expect(result.current.isPending).toBe(false);
    expect(mockLocation.href).toBe('https://meet.google.com/abc-defg-hij');
    expect(mockToast).not.toHaveBeenCalled();
  });
});

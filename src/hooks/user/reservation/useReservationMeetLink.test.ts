import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FetchApiError, FetchHttpError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';
import { mockToast } from '@/test/mocks/useToast';

import { useReservationMeetLink } from './useReservationMeetLink';

// Mock useToast
vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

// Mock service
vi.mock('@/services/reservations', () => ({
  fetchReservationMeetLink: vi.fn(),
}));

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

  it('shows error toast when myUserId is missing', async () => {
    const { result } = renderHook(() => useReservationMeetLink({}));

    await result.current.joinMeet('res-123');

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '錯誤',
      description: '無法取得目前使用者資訊，請重新登入。',
    });
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('opens a blank window and redirects to meet_url upon API success', async () => {
    const mockLocation = { href: '' };
    const mockOpenedWindow = { location: mockLocation, close: vi.fn() };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    vi.mocked(fetchReservationMeetLink).mockResolvedValue({
      meet_url: 'https://meet.google.com/abc-defg-hij',
    });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    expect(mockWindowOpen).toHaveBeenCalledWith('about:blank', '_blank');
    expect(fetchReservationMeetLink).toHaveBeenCalledWith({
      userId: 'user-456',
      reservationId: 'res-123',
    });

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://meet.google.com/abc-defg-hij');
    });
  });

  it('closes the opened window and shows error toast upon API failure (404)', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    const mockError = new FetchApiError('404', 'not found', '/google-meet');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    expect(mockWindowOpen).toHaveBeenCalledWith('about:blank', '_blank');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '連結尚未就緒或不存在（會議狀態需為已排程）。',
      });
    });
  });

  it('closes the opened window and shows error toast upon API failure (403)', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    const mockError = new FetchApiError('403', 'forbidden', '/google-meet');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '您並非此預約的導師或學員，無法加入。',
      });
    });
  });

  it('closes the opened window and shows error toast upon generic API failure', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    const mockError = new Error('unexpected');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '取得會議連結失敗，請稍後再試。',
      });
    });
  });

  it('handles empty meet_url from successful API response', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    vi.mocked(fetchReservationMeetLink).mockResolvedValue({
      meet_url: '',
    });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '找不到會議連結',
        description: '此預約尚未就緒，或會議連結不存在。',
      });
    });
  });

  it('redirects current window directly if pop-up window is blocked by browser', async () => {
    mockWindowOpen.mockReturnValue(null); // Simulated browser popup blocker

    const originalLocation = window.location;
    const mockLocation = { href: '' };
    delete (window as unknown as { location: unknown }).location;
    (window as unknown as { location: unknown }).location = mockLocation;

    vi.mocked(fetchReservationMeetLink).mockResolvedValue({
      meet_url: 'https://meet.google.com/abc-defg-hij',
    });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    expect(mockWindowOpen).toHaveBeenCalledWith('about:blank', '_blank');

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://meet.google.com/abc-defg-hij');
    });

    (window as unknown as { location: unknown }).location = originalLocation;
  });

  it('closes the opened window and shows error toast upon API failure (status-based 404)', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    const mockError = new FetchHttpError(404, '/google-meet');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '連結尚未就緒或不存在（會議狀態需為已排程）。',
      });
    });
  });

  it('closes the opened window and throws error for unsafe/invalid meet_url', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    vi.mocked(fetchReservationMeetLink).mockResolvedValue({
      meet_url: 'https://unsafe-hijack-domain.com/some-path',
    });

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '取得會議連結失敗，請稍後再試。',
      });
    });
  });

  it('closes the opened window and ignores ConcurrentActionError without showing toast', async () => {
    const mockClose = vi.fn();
    const mockOpenedWindow = { location: { href: '' }, close: mockClose };
    mockWindowOpen.mockReturnValue(mockOpenedWindow);

    const mockError = { name: 'ConcurrentActionError', message: 'prevented' };
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    const { result } = renderHook(() =>
      useReservationMeetLink({ myUserId: 'user-456' })
    );

    result.current.joinMeet('res-123');

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });
  });
});

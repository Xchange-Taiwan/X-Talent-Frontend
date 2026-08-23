import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import { fetchReservationMeetLink } from '@/services/reservations';
import { mockToast } from '@/test/mocks/useToast';
import type { Reservation } from '@/types/reservation';

import { ReservationCard } from './ReservationCard';

// Mock useToast
vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

// Mock service
vi.mock('@/services/reservations', () => ({
  fetchReservationMeetLink: vi.fn(),
}));

const mockReservation: Reservation = {
  id: 'res-123',
  name: 'John Doe',
  roleLine: 'UIUX Designer',
  date: 'Mon, Aug 03, 2026',
  time: '10:00 am – 11:00 am',
  avatar: undefined,
  messages: [],
  senderUserId: 1,
  participantUserId: 2,
  dtstart: 0,
  dtend: 0,
  scheduleId: 0,
  version: 0,
};

describe('ReservationCard', () => {
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

  it('renders standard card details', () => {
    render(<ReservationCard item={mockReservation} variant="upcoming" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('UIUX Designer')).toBeInTheDocument();
    expect(screen.getByText('Mon, Aug 03, 2026')).toBeInTheDocument();
    expect(screen.getByText('10:00 am – 11:00 am')).toBeInTheDocument();
  });

  it('renders "Join Google Meet" button only when variant is upcoming', () => {
    const { rerender } = render(
      <ReservationCard item={mockReservation} variant="upcoming" />
    );
    expect(
      screen.getByRole('button', { name: /加入 Google Meet/i })
    ).toBeInTheDocument();

    rerender(<ReservationCard item={mockReservation} variant="pending" />);
    expect(
      screen.queryByRole('button', { name: /加入 Google Meet/i })
    ).not.toBeInTheDocument();

    rerender(<ReservationCard item={mockReservation} variant="history" />);
    expect(
      screen.queryByRole('button', { name: /加入 Google Meet/i })
    ).not.toBeInTheDocument();
  });

  it('shows error toast when myUserId is missing', () => {
    render(<ReservationCard item={mockReservation} variant="upcoming" />);

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    const mockError = new ApiError(404, 'not found');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    const mockError = new ApiError(403, 'forbidden');
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(mockError);

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

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

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

    expect(mockWindowOpen).toHaveBeenCalledWith('about:blank', '_blank');

    await waitFor(() => {
      expect(mockLocation.href).toBe('https://meet.google.com/abc-defg-hij');
    });

    (window as unknown as { location: unknown }).location = originalLocation;
  });
});

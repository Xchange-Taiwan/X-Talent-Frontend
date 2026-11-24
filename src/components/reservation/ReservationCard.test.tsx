import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';
import {
  buildReservationFixture,
  resolveReservationViewer,
} from '@/lib/reservation/reservationProjection';
import { fetchReservationMeetLink } from '@/services/reservations';
import { mockToast } from '@/test/mocks/useToast';
import type { Reservation } from '@/types/reservation';

import { ReservationCard } from './ReservationCard';

vi.mock('@/lib/reservation/reservationProjection', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/lib/reservation/reservationProjection')
    >();
  return {
    ...actual,
    resolveReservationViewer: vi.fn(actual.resolveReservationViewer),
  };
});

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
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('UIUX Designer')).toBeInTheDocument();
    expect(screen.getByText('Mon, Aug 03, 2026')).toBeInTheDocument();
    expect(screen.getByText('10:00 am – 11:00 am')).toBeInTheDocument();
  });

  it('derives initials from the shared getInitials helper', () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('falls back to U when the name is empty', () => {
    render(
      <ReservationCard
        item={{ ...mockReservation, name: '' }}
        variant="upcoming"
        sourceRole="mentor"
      />
    );

    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('renders the name and role line as block elements so truncate takes effect', () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        profileHref="/profile/1"
        sourceRole="mentor"
      />
    );

    expect(screen.getByText('John Doe')).toHaveClass('truncate');
    expect(screen.getByText('John Doe').tagName).toBe('DIV');
    expect(screen.getByText('UIUX Designer')).toHaveClass('truncate');
    expect(screen.getByText('UIUX Designer').tagName).toBe('DIV');
  });

  it('wraps the role line inside the profile link alongside the name, so it stays width-constrained by the status badge', () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        profileHref="/profile/1"
        sourceRole="mentor"
      />
    );

    const link = screen.getByRole('link', { name: 'John Doe UIUX Designer' });
    expect(link).toContainElement(screen.getByText('UIUX Designer'));
  });

  it('forwards the native click event to onProfileClick', () => {
    const onProfileClick = vi.fn();
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        profileHref="/profile/1"
        onProfileClick={onProfileClick}
        sourceRole="mentor"
      />
    );

    fireEvent.click(
      screen.getByRole('link', { name: 'John Doe UIUX Designer' })
    );

    expect(onProfileClick).toHaveBeenCalledTimes(1);
    expect(onProfileClick.mock.calls[0][0]).toMatchObject({
      type: 'click',
    });
  });

  it('uses flex-nowrap to avoid deforming when long names are rendered', () => {
    const { container } = render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );
    // Find the name container flex element
    const flexContainer = container.querySelector('.min-w-0.flex-1 > div');
    expect(flexContainer).toBeInTheDocument();
    expect(flexContainer).toHaveClass('flex');
    expect(flexContainer).toHaveClass('min-w-0');
    expect(flexContainer).toHaveClass('items-start');
    expect(flexContainer).toHaveClass('justify-between');
    expect(flexContainer).toHaveClass('gap-2');
    expect(flexContainer).not.toHaveClass('flex-wrap');
  });

  it('renders "Join Google Meet" button only when variant is upcoming', () => {
    const { rerender } = render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );
    expect(
      screen.getByRole('button', { name: /加入 Google Meet/i })
    ).toBeInTheDocument();

    rerender(
      <ReservationCard
        item={mockReservation}
        variant="pending"
        sourceRole="mentor"
      />
    );
    expect(
      screen.queryByRole('button', { name: /加入 Google Meet/i })
    ).not.toBeInTheDocument();

    rerender(
      <ReservationCard
        item={mockReservation}
        variant="history"
        sourceRole="mentor"
      />
    );
    expect(
      screen.queryByRole('button', { name: /加入 Google Meet/i })
    ).not.toBeInTheDocument();
  });

  it('does not render "會議連結已寄至您的信箱" when variant is upcoming and Join Google Meet is shown', () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );
    expect(
      screen.queryByText('會議連結已寄至您的信箱')
    ).not.toBeInTheDocument();
  });

  it('shows error toast when myUserId is missing', async () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );

    const button = screen.getByRole('button', { name: /加入 Google Meet/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '無法取得目前使用者資訊，請重新登入。',
      });
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
        sourceRole="mentor"
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

  // The 403 / 404 / generic / empty-link / popup-blocked / unsafe-URL matrix
  // is covered once in src/lib/reservation/joinReservationMeet.test.ts; this
  // only proves the card surfaces a failed join as a toast.
  it('surfaces a failed join as a destructive toast and closes the placeholder tab', async () => {
    const mockClose = vi.fn();
    mockWindowOpen.mockReturnValue({
      location: { href: '' },
      close: mockClose,
    });
    vi.mocked(fetchReservationMeetLink).mockRejectedValue(
      new ApiError(404, 'not found')
    );

    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        myUserId="user-456"
        sourceRole="mentor"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /加入 Google Meet/i }));

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '錯誤',
        description: '連結尚未就緒或不存在（會議狀態需為已排程）。',
      });
    });
  });

  it('renders ReservationStatusBadge in the header container rather than the date/time row', () => {
    const { container } = render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );
    // Find the header flex container (min-w-0 flex-1 > div)
    const headerContainer = container.querySelector('.min-w-0.flex-1 > div');
    expect(headerContainer).toBeInTheDocument();

    // Use within to assert that ReservationStatusBadge is inside the headerContainer
    const badge = headerContainer?.querySelector('[role="status"]');
    expect(badge).toBeInTheDocument();

    // Confirm it is NOT inside the date/time row
    const dateTimeRow = container.querySelector('.text-text-tertiary.mt-2');
    const badgeInDateTime = dateTimeRow?.querySelector('[role="status"]');
    expect(badgeInDateTime).not.toBeInTheDocument();
  });

  it('renders JoinMeetButton with responsive text spans to avoid layout breaking', () => {
    render(
      <ReservationCard
        item={mockReservation}
        variant="upcoming"
        sourceRole="mentor"
      />
    );
    const joinButton = screen.getByRole('button', {
      name: /加入 Google Meet/i,
    });
    expect(joinButton).toBeInTheDocument();

    // Check that the button contains both responsive spans
    const desktopSpan = joinButton.querySelector('.hidden.sm\\:inline');
    const mobileSpan = joinButton.querySelector('.sm\\:hidden');

    expect(desktopSpan).toBeInTheDocument();
    expect(desktopSpan?.textContent).toBe('加入 Google Meet');
    expect(mobileSpan).toBeInTheDocument();
    expect(mobileSpan?.textContent).toBe('加入會議');
  });

  describe('history status badge and headerAction behavior (#730)', () => {
    it('renders cancelled/rejected status badges when headerAction is omitted on history cards', () => {
      const { rerender } = render(
        <ReservationCard
          item={{ ...mockReservation, cancelledBy: 'MENTOR' }}
          variant="history"
          sourceRole="mentee"
        />
      );
      expect(screen.getByRole('status')).toHaveTextContent('已由導師取消');

      rerender(
        <ReservationCard
          item={{ ...mockReservation, cancelledBy: 'MENTEE' }}
          variant="history"
          sourceRole="mentor"
        />
      );
      expect(screen.getByRole('status')).toHaveTextContent('已由學員取消');

      rerender(
        <ReservationCard
          item={{ ...mockReservation, cancelledBy: 'SYSTEM' }}
          variant="history"
          sourceRole="mentee"
        />
      );
      expect(screen.getByRole('status')).toHaveTextContent('已自動取消');
      expect(screen.getByRole('note')).toHaveTextContent(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      );
    });

    it('falls back to ReservationStatusBadge (已結束) when history card has neither headerAction nor cancelledBy, and hides fallback badge when headerAction is provided', () => {
      const { rerender } = render(
        <ReservationCard
          item={mockReservation}
          variant="history"
          sourceRole="mentor"
        />
      );
      expect(screen.getByRole('status')).toHaveTextContent('已結束');

      rerender(
        <ReservationCard
          item={mockReservation}
          variant="history"
          sourceRole="mentee"
          headerAction={<button type="button">填寫回饋</button>}
        />
      );
      expect(
        screen.getByRole('button', { name: '填寫回饋' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('reads pre-projected cancelledByLabel off item and skips resolveReservationViewer when headerAction is supplied (#932)', () => {
      const preProjected = buildReservationFixture({
        id: 'res-proj-card',
        cancelledBy: 'MENTEE',
        viewerRole: 'MENTOR',
        myUserId: 'user-mentor-222',
      });

      vi.mocked(resolveReservationViewer).mockClear();

      const { rerender } = render(
        <ReservationCard
          item={preProjected}
          myUserId="user-mentor-222"
          variant="history"
          sourceRole="mentor"
        />
      );
      expect(screen.getByRole('status')).toHaveTextContent('已由學員取消');
      expect(resolveReservationViewer).not.toHaveBeenCalled();

      rerender(
        <ReservationCard
          item={{ ...mockReservation, cancelledBy: 'MENTOR' }}
          variant="history"
          sourceRole="mentee"
          headerAction={<span>預先傳入標籤</span>}
        />
      );
      expect(screen.getByText('預先傳入標籤')).toBeInTheDocument();
      expect(resolveReservationViewer).not.toHaveBeenCalled();
    });
  });
});

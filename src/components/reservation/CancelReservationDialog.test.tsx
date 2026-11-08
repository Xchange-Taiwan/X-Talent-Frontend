import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import CancelReservationDialog from './CancelReservationDialog';

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

describe('CancelReservationDialog', () => {
  const mockReservation: Reservation = {
    id: 'res-301',
    name: 'Dana Mentor',
    roleLine: 'Mentor',
    date: '2026-08-10',
    time: '2:00 PM – 2:30 PM',
    dtstart: Math.floor(new Date('2026-08-10T14:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-08-10T14:30:00Z').getTime() / 1000),
    messages: [],
    menteeMessage: { content: '想請教職涯規劃的問題。' },
    scheduleId: 301,
    version: 1,
    senderUserId: 'user-mentee',
    participantUserId: 'user-mentor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trigger and confirm buttons with destructive variant classes', () => {
    render(<CancelReservationDialog reservation={mockReservation} />);

    const trigger = screen.getByRole('button', { name: '取消預約' });
    expect(trigger).toHaveClass('bg-status-error-default');
    expect(trigger).toHaveClass('hover:bg-status-error-active');

    fireEvent.click(trigger);

    const confirmButtons = screen.getAllByRole('button', { name: '取消預約' });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    expect(confirmButton).toHaveClass('bg-status-error-default');
    expect(confirmButton).toHaveClass('hover:bg-status-error-active');
  });

  it('disables the confirm button until a reason is entered, then calls onConfirmCancel with it', () => {
    const onConfirmCancel = vi.fn();
    render(
      <CancelReservationDialog
        reservation={mockReservation}
        onConfirmCancel={onConfirmCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '取消預約' }));

    const confirmButtons = screen.getAllByRole('button', { name: '取消預約' });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/您好 Dana/), {
      target: { value: '臨時有事無法出席' },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onConfirmCancel).toHaveBeenCalledWith({
      id: 'res-301',
      reason: '臨時有事無法出席',
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import RejectReservationDialog from './RejectReservationDialog';

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

describe('RejectReservationDialog', () => {
  const mockReservation: Reservation = {
    id: 'res-401',
    name: 'Evan Mentee',
    roleLine: 'Mentee',
    date: '2026-08-12',
    time: '4:00 PM – 4:30 PM',
    dtstart: Math.floor(new Date('2026-08-12T16:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-08-12T16:30:00Z').getTime() / 1000),
    messages: [],
    menteeMessage: { content: '想請教面試技巧。' },
    scheduleId: 401,
    version: 1,
    senderUserId: 'user-mentee',
    participantUserId: 'user-mentor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trigger and confirm buttons with destructive variant classes', () => {
    render(<RejectReservationDialog reservation={mockReservation} />);

    const trigger = screen.getByRole('button', { name: '拒絕' });
    expect(trigger).toHaveClass('bg-status-error-default');
    expect(trigger).toHaveClass('hover:bg-status-error-active');

    fireEvent.click(trigger);

    const confirmButtons = screen.getAllByRole('button', { name: '拒絕' });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    expect(confirmButton).toHaveClass('bg-status-error-default');
    expect(confirmButton).toHaveClass('hover:bg-status-error-active');
  });

  it('disables the confirm button until a reason is entered, then calls onReject with it', () => {
    const onReject = vi.fn();
    render(
      <RejectReservationDialog
        reservation={mockReservation}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '拒絕' }));

    const confirmButtons = screen.getAllByRole('button', { name: '拒絕' });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('請在此輸入原因...'), {
      target: { value: '時段衝突' },
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onReject).toHaveBeenCalledWith({
      id: 'res-401',
      reason: '時段衝突',
    });
  });
});

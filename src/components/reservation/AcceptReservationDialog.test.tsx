import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import AcceptReservationDialog from './AcceptReservationDialog';

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

describe('AcceptReservationDialog', () => {
  const mockReservation: Reservation = {
    id: 'res-201',
    name: 'Carol Mentee',
    roleLine: 'Mentee',
    date: '2026-07-26',
    time: '11:00 AM – 11:30 AM',
    dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
    messages: [],
    menteeMessage: { content: '想請教職涯規劃的問題。' },
    scheduleId: 201,
    version: 1,
    senderUserId: 'user-mentee',
    participantUserId: 'user-mentor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the counterparty name and mentee message once opened', () => {
    render(
      <AcceptReservationDialog
        reservation={mockReservation}
        myUserId="user-mentor"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '接受' }));

    expect(screen.getByText('Carol Mentee')).toBeInTheDocument();
    expect(screen.getByText('想請教職涯規劃的問題。')).toBeInTheDocument();
  });

  it('renders the counterparty name as a profile link when myUserId is provided', () => {
    render(
      <AcceptReservationDialog
        reservation={mockReservation}
        myUserId="user-mentor"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '接受' }));

    const nameLink = screen.getByRole('link', { name: 'Carol Mentee' });
    expect(nameLink).toHaveAttribute('href', '/profile/user-mentee');
  });

  it('renders the counterparty name as plain text (no link) when myUserId is not provided', () => {
    render(<AcceptReservationDialog reservation={mockReservation} />);

    fireEvent.click(screen.getByRole('button', { name: '接受' }));

    expect(
      screen.queryByRole('link', { name: 'Carol Mentee' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Carol Mentee')).toBeInTheDocument();
  });

  it('closes the dialog when clicking the profile link under non-submitting state', () => {
    render(
      <AcceptReservationDialog
        reservation={mockReservation}
        myUserId="user-mentor"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '接受' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const nameLink = screen.getByRole('link', { name: 'Carol Mentee' });
    fireEvent.click(nameLink);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables the trigger button when disabled is true', () => {
    render(<AcceptReservationDialog reservation={mockReservation} disabled />);

    expect(screen.getByRole('button', { name: '接受' })).toBeDisabled();
  });

  it('calls onAccept with the trimmed reply message', async () => {
    const onAccept = vi.fn();
    render(
      <AcceptReservationDialog
        reservation={mockReservation}
        myUserId="user-mentor"
        onAccept={onAccept}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '接受' }));

    const acceptButtons = screen.getAllByRole('button', { name: '接受' });
    fireEvent.click(acceptButtons[acceptButtons.length - 1]);

    expect(onAccept).toHaveBeenCalledWith({ id: 'res-201', message: '' });
  });
});

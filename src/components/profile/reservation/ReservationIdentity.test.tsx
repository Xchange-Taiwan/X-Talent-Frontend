import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { ReservationIdentity } from './ReservationIdentity';

describe('ReservationIdentity', () => {
  const mockReservation: Reservation = {
    id: 'res-1',
    name: 'Alice User',
    roleLine: 'Mentee',
    date: '2026-07-26',
    time: '11:00 AM – 11:30 AM',
    dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
    messages: [],
    scheduleId: 1,
    version: 1,
    senderUserId: 'user-alice',
    participantUserId: 'user-mentor',
  };

  it('renders name, role line, date and time', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
      />
    );

    expect(screen.getByText('Alice User')).toBeInTheDocument();
    expect(screen.getByText('Mentee')).toBeInTheDocument();
    expect(screen.getByText('2026-07-26')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM – 11:30 AM')).toBeInTheDocument();
  });

  it('derives initials from the shared getInitials helper', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
      />
    );

    expect(screen.getByText('AU')).toBeInTheDocument();
  });

  it('does not render the status badge by default', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
      />
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the status badge when showStatusBadge is true', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
        showStatusBadge
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render a mentee message block when there is no message', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
      />
    );

    expect(screen.queryByText('學員留言')).not.toBeInTheDocument();
  });

  it('renders the mentee message block when present', () => {
    render(
      <ReservationIdentity
        reservation={{
          ...mockReservation,
          menteeMessage: { content: '這是學員的測試留言。' },
        }}
        profileHref="/profile/user-alice"
      />
    );

    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('這是學員的測試留言。')).toBeInTheDocument();
  });

  it('renders the name and avatar as links when a profileHref is provided', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
      />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Alice User' })
    ).toBeInTheDocument();
  });

  it('renders plain, non-interactive elements when no profileHref is provided', () => {
    render(<ReservationIdentity reservation={mockReservation} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Alice User')).toBeInTheDocument();
  });

  it('renders plain elements when linkToProfile is false, even with an href', () => {
    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
        linkToProfile={false}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('prevents navigation on the profile link when disabled', () => {
    const onProfileLinkClick = vi.fn((e: React.MouseEvent) =>
      e.preventDefault()
    );

    render(
      <ReservationIdentity
        reservation={mockReservation}
        profileHref="/profile/user-alice"
        onProfileLinkClick={onProfileLinkClick}
        disabled
      />
    );

    const nameLink = screen.getByRole('link', { name: 'Alice User' });
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    fireEvent(nameLink, clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(onProfileLinkClick).not.toHaveBeenCalled();
  });
});

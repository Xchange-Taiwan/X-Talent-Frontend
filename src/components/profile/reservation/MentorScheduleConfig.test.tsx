import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/lib/profile/bookingAvailability';
import type { Reservation } from '@/types/reservation';

import { MentorScheduleConfig } from './MentorScheduleConfig';

const getRowButtonForMentee = (name: string) => {
  const textNode = screen.getByText(name);
  const row = textNode.closest('.border') as HTMLElement;
  return within(row).getByRole('button', { name: /查看.*預約詳情/ });
};

vi.mock('./QuickReplyDialog', () => ({
  QuickReplyDialog: vi.fn(({ reservation, open, onOpenChange }) =>
    open ? (
      <div data-testid="mock-quick-reply" data-reservation-id={reservation?.id}>
        Quick Reply Dialog for {reservation?.name}
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('./ConfirmedReservationDialog', () => ({
  ConfirmedReservationDialog: vi.fn(({ reservation, open, onOpenChange }) =>
    open ? (
      <div
        data-testid="mock-confirmed-dialog"
        data-reservation-id={reservation?.id}
      >
        Confirmed Reservation Dialog for {reservation?.name}
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
}));

describe('MentorScheduleConfig', () => {
  const mockPendingReservation: Reservation = {
    id: 'res-103',
    name: 'Bob',
    roleLine: 'Mentee',
    date: '2026-07-26',
    time: '12:00 PM – 12:30 PM',
    dtstart: Math.floor(new Date('2026-07-26T12:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-07-26T12:30:00Z').getTime() / 1000),
    messages: [],
    scheduleId: 103,
    version: 1,
    senderUserId: 'user-bob',
    participantUserId: 'user-mentor',
  };

  const mockSlots: BookingSlot[] = [
    {
      scheduleId: 101,
      start: new Date('2026-07-26T10:00:00Z'),
      end: new Date('2026-07-26T10:30:00Z'),
      isBooked: false,
      status: null,
    },
    {
      scheduleId: 102,
      start: new Date('2026-07-26T11:00:00Z'),
      end: new Date('2026-07-26T11:30:00Z'),
      isBooked: true,
      status: 'BOOKED',
      menteeName: 'Alice',
    },
    {
      scheduleId: 103,
      start: new Date('2026-07-26T12:00:00Z'),
      end: new Date('2026-07-26T12:30:00Z'),
      isBooked: false,
      status: 'PENDING',
      menteeName: 'Bob',
      reservation: mockPendingReservation,
    },
    {
      scheduleId: 104,
      start: new Date('2026-07-26T13:00:00Z'),
      end: new Date('2026-07-26T13:30:00Z'),
      isBooked: true,
      status: null,
    },
  ];

  const defaultProps = {
    slotsSnapshot: {
      slots: mockSlots,
      monthLoaded: true,
      reservationsLoaded: true,
    },
    onReservation: vi.fn(),
    onBookedSlotClick: vi.fn(),
    myUserId: 'user-mentor',
    onMutationSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders split view with Booked and Available sections', () => {
    render(<MentorScheduleConfig {...defaultProps} />);

    // Renders headings
    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();

    // Renders slots
    expect(screen.getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM – 11:30 AM')).toBeInTheDocument();
    expect(screen.getByText('12:00 PM – 12:30 PM')).toBeInTheDocument();
    expect(screen.getByText('01:00 PM – 01:30 PM')).toBeInTheDocument();

    // Renders names and status labels/text
    expect(screen.getByText('學員 Alice')).toBeInTheDocument();
    expect(screen.getByText('已確認')).toBeInTheDocument();

    expect(screen.getByText('學員 Bob')).toBeInTheDocument();
    expect(screen.getByText('待您回復')).toBeInTheDocument();

    // Renders blocked slots correctly (no mentee, status is null, but isBooked is true)
    expect(screen.getByText('時段已保留')).toBeInTheDocument();
    expect(screen.getByText('已保留')).toBeInTheDocument();
  });

  it('triggers onReservation when booking setup button is clicked', () => {
    const onReservation = vi.fn();
    render(
      <MentorScheduleConfig {...defaultProps} onReservation={onReservation} />
    );

    const setupBtn = screen.getByRole('button', { name: '預約設定' });
    fireEvent.click(setupBtn);
    expect(onReservation).toHaveBeenCalledOnce();
  });

  it('triggers onBookedSlotClick when a confirmed booked slot row is clicked', () => {
    const onBookedSlotClick = vi.fn();
    render(
      <MentorScheduleConfig
        {...defaultProps}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const confirmedRowButton = getRowButtonForMentee('學員 Alice');
    fireEvent.click(confirmedRowButton);

    expect(onBookedSlotClick).toHaveBeenCalledOnce();
  });

  it('opens ConfirmedReservationDialog and does NOT trigger onBookedSlotClick when a confirmed booked slot with a matched reservation is clicked', () => {
    const onBookedSlotClick = vi.fn();
    const mockConfirmedReservation: Reservation = {
      id: 'res-102',
      name: 'Alice',
      roleLine: 'Mentee',
      date: '2026-07-26',
      time: '11:00 AM – 11:30 AM',
      dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
      dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
      messages: [],
      scheduleId: 102,
      version: 1,
      senderUserId: 'user-alice',
      participantUserId: 'user-mentor',
    };
    const slotsWithConfirmedReservation = mockSlots.map((slot) =>
      slot.scheduleId === 102
        ? { ...slot, reservation: mockConfirmedReservation }
        : slot
    );

    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          slots: slotsWithConfirmedReservation,
        }}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const confirmedRowButton = getRowButtonForMentee('學員 Alice');
    fireEvent.click(confirmedRowButton);

    const mockDialog = screen.getByTestId('mock-confirmed-dialog');
    expect(mockDialog).toBeInTheDocument();
    expect(mockDialog).toHaveAttribute('data-reservation-id', 'res-102');
    expect(onBookedSlotClick).not.toHaveBeenCalled();
  });

  it('updates ConfirmedReservationDialog correctly when clicking different confirmed booked slots sequentially', () => {
    const onBookedSlotClick = vi.fn();
    const mockConfirmedReservation1: Reservation = {
      id: 'res-102',
      name: 'Alice',
      roleLine: 'Mentee',
      date: '2026-07-26',
      time: '11:00 AM – 11:30 AM',
      dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
      dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
      messages: [],
      scheduleId: 102,
      version: 1,
      senderUserId: 'user-alice',
      participantUserId: 'user-mentor',
    };
    const mockConfirmedReservation2: Reservation = {
      id: 'res-104',
      name: 'Charlie',
      roleLine: 'Mentee',
      date: '2026-07-26',
      time: '01:00 PM – 01:30 PM',
      dtstart: Math.floor(new Date('2026-07-26T13:00:00Z').getTime() / 1000),
      dtend: Math.floor(new Date('2026-07-26T13:30:00Z').getTime() / 1000),
      messages: [],
      scheduleId: 104,
      version: 1,
      senderUserId: 'user-charlie',
      participantUserId: 'user-mentor',
    };
    const slotsWithTwoConfirmedReservations = mockSlots.map((slot) => {
      if (slot.scheduleId === 102) {
        return { ...slot, reservation: mockConfirmedReservation1 };
      }
      if (slot.scheduleId === 104) {
        return {
          ...slot,
          status: 'BOOKED' as const,
          menteeName: 'Charlie',
          reservation: mockConfirmedReservation2,
        };
      }
      return slot;
    });

    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          slots: slotsWithTwoConfirmedReservations,
        }}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const aliceRowButton = getRowButtonForMentee('學員 Alice');
    fireEvent.click(aliceRowButton);

    let mockDialog = screen.getByTestId('mock-confirmed-dialog');
    expect(mockDialog).toBeInTheDocument();
    expect(mockDialog).toHaveAttribute('data-reservation-id', 'res-102');

    const charlieRowButton = getRowButtonForMentee('學員 Charlie');
    fireEvent.click(charlieRowButton);

    mockDialog = screen.getByTestId('mock-confirmed-dialog');
    expect(mockDialog).toBeInTheDocument();
    expect(mockDialog).toHaveAttribute('data-reservation-id', 'res-104');
    expect(onBookedSlotClick).not.toHaveBeenCalled();
  });

  it('opens QuickReplyDialog and does NOT trigger onBookedSlotClick when a pending slot with a matched reservation is clicked', () => {
    const onBookedSlotClick = vi.fn();
    render(
      <MentorScheduleConfig
        {...defaultProps}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const pendingRowButton = getRowButtonForMentee('學員 Bob');
    fireEvent.click(pendingRowButton);

    const mockDialog = screen.getByTestId('mock-quick-reply');
    expect(mockDialog).toBeInTheDocument();
    expect(mockDialog).toHaveAttribute('data-reservation-id', 'res-103');
    expect(onBookedSlotClick).not.toHaveBeenCalled();
  });

  it('falls back to onBookedSlotClick when a pending slot has no matched reservation', () => {
    const onBookedSlotClick = vi.fn();
    const slotsWithoutReservation = mockSlots.map((slot) =>
      slot.scheduleId === 103 ? { ...slot, reservation: undefined } : slot
    );
    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          slots: slotsWithoutReservation,
        }}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const pendingRowButton = getRowButtonForMentee('學員 Bob');
    fireEvent.click(pendingRowButton);

    expect(screen.queryByTestId('mock-quick-reply')).not.toBeInTheDocument();
    expect(onBookedSlotClick).toHaveBeenCalledOnce();
  });

  it('renders loading states for both sections when monthLoaded is false', () => {
    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{ ...defaultProps.slotsSnapshot, monthLoaded: false }}
      />
    );

    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    expect(screen.getAllByText('讀取中…')).toHaveLength(2);
  });

  it('renders the Booked section as loading (and unclickable) when reservationsLoaded is false, even once monthLoaded is true', () => {
    // Regression test: schedule status (monthLoaded) can resolve before the
    // reservations fetch does, most visibly right after this tree remounts
    // (e.g. navigating back to the profile page). Rendering booked slots
    // during that gap risks a PENDING slot whose `.reservation` hasn't
    // arrived yet, which would misfire the redirect fallback instead of
    // opening the quick-reply dialog.
    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          reservationsLoaded: false,
        }}
      />
    );

    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('讀取中…')).toBeInTheDocument();
    expect(screen.queryByText('學員 Bob')).not.toBeInTheDocument();
    // Available section doesn't depend on reservations, so it still renders.
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
  });

  it('renders empty states for both sections when slots are empty', () => {
    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{ ...defaultProps.slotsSnapshot, slots: [] }}
      />
    );

    expect(screen.getByText('目前無已預約時段')).toBeInTheDocument();
    expect(screen.getByText('無可預約的時段')).toBeInTheDocument();
  });

  it('closes ConfirmedReservationDialog and clears activeDialogType when onOpenChange(false) is triggered', () => {
    const mockConfirmedReservation: Reservation = {
      id: 'res-102',
      name: 'Alice',
      roleLine: 'Mentee',
      date: '2026-07-26',
      time: '11:00 AM – 11:30 AM',
      dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
      dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
      messages: [],
      scheduleId: 102,
      version: 1,
      senderUserId: 'user-alice',
      participantUserId: 'user-mentor',
    };
    const slotsWithConfirmedReservation = mockSlots.map((slot) =>
      slot.scheduleId === 102
        ? { ...slot, reservation: mockConfirmedReservation }
        : slot
    );

    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          slots: slotsWithConfirmedReservation,
        }}
      />
    );

    const confirmedRowButton = getRowButtonForMentee('學員 Alice');
    fireEvent.click(confirmedRowButton);

    const mockDialog = screen.getByTestId('mock-confirmed-dialog');
    expect(mockDialog).toBeInTheDocument();

    const closeBtn = within(mockDialog).getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByTestId('mock-confirmed-dialog')
    ).not.toBeInTheDocument();
  });

  it('closes QuickReplyDialog and clears activeDialogType when onOpenChange(false) is triggered', () => {
    render(<MentorScheduleConfig {...defaultProps} />);

    const pendingRowButton = getRowButtonForMentee('學員 Bob');
    fireEvent.click(pendingRowButton);

    const mockDialog = screen.getByTestId('mock-quick-reply');
    expect(mockDialog).toBeInTheDocument();

    const closeBtn = within(mockDialog).getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('mock-quick-reply')).not.toBeInTheDocument();
  });

  it('renders avatar and text for both PENDING and BOOKED slots without profile links', () => {
    const mockConfirmedReservation: Reservation = {
      id: 'res-102',
      name: 'Alice',
      roleLine: 'Mentee',
      date: '2026-07-26',
      time: '11:00 AM – 11:30 AM',
      dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
      dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
      messages: [],
      scheduleId: 102,
      version: 1,
      senderUserId: 'user-alice',
      participantUserId: 'user-mentor',
    };
    const slotsWithConfirmedReservation = mockSlots.map((slot) =>
      slot.scheduleId === 102
        ? { ...slot, reservation: mockConfirmedReservation }
        : slot
    );

    render(
      <MentorScheduleConfig
        {...defaultProps}
        slotsSnapshot={{
          ...defaultProps.slotsSnapshot,
          slots: slotsWithConfirmedReservation,
        }}
      />
    );

    // Booked slot row (Alice) should not contain any links to profile —
    // avatar/name are only clickable via the row's dialog-opening button.
    const aliceRow = screen
      .getByText('學員 Alice')
      .closest('.border') as HTMLElement;
    expect(aliceRow).toBeInTheDocument();
    expect(within(aliceRow).queryAllByRole('link')).toHaveLength(0);

    // Pending slot row (Bob) should not contain any links to profile either
    const bobRow = screen
      .getByText('學員 Bob')
      .closest('.border') as HTMLElement;
    expect(bobRow).toBeInTheDocument();
    expect(within(bobRow).queryAllByRole('link')).toHaveLength(0);
  });

  it('triggers dialog on keydown (Enter/Space) on booked slot rows', async () => {
    const user = userEvent.setup();
    render(<MentorScheduleConfig {...defaultProps} />);

    const pendingRowButton = getRowButtonForMentee('學員 Bob');
    expect(pendingRowButton).toBeInTheDocument();

    pendingRowButton.focus();

    // Trigger Enter keydown
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('mock-quick-reply')).toBeInTheDocument();

    // Close the dialog
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await user.click(closeBtn);
    expect(screen.queryByTestId('mock-quick-reply')).not.toBeInTheDocument();

    pendingRowButton.focus();

    // Trigger Space keydown
    await user.keyboard(' ');
    expect(screen.getByTestId('mock-quick-reply')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/hooks/useMentorSchedule';

import { MentorScheduleConfig } from './MentorScheduleConfig';

describe('MentorScheduleConfig', () => {
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
    slots: mockSlots,
    monthLoaded: true,
    onReservation: vi.fn(),
    onBookedSlotClick: vi.fn(),
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

  it('triggers onBookedSlotClick when a booked slot row is clicked', () => {
    const onBookedSlotClick = vi.fn();
    render(
      <MentorScheduleConfig
        {...defaultProps}
        onBookedSlotClick={onBookedSlotClick}
      />
    );

    const confirmedRow = screen.getByText('學員 Alice').closest('button');
    expect(confirmedRow).not.toBeNull();
    fireEvent.click(confirmedRow!);

    expect(onBookedSlotClick).toHaveBeenCalledOnce();

    const pendingRow = screen.getByText('學員 Bob').closest('button');
    expect(pendingRow).not.toBeNull();
    fireEvent.click(pendingRow!);

    expect(onBookedSlotClick).toHaveBeenCalledTimes(2);
  });

  it('renders loading states for both sections when monthLoaded is false', () => {
    render(<MentorScheduleConfig {...defaultProps} monthLoaded={false} />);

    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    expect(screen.getAllByText('讀取中…')).toHaveLength(2);
  });

  it('renders empty states for both sections when slots are empty', () => {
    render(<MentorScheduleConfig {...defaultProps} slots={[]} />);

    expect(screen.getByText('目前無已預約時段')).toBeInTheDocument();
    expect(screen.getByText('無可預約的時段')).toBeInTheDocument();
  });
});

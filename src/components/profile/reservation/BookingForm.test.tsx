import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/hooks/useMentorSchedule';

import { BookingForm } from './BookingForm';

describe('BookingForm', () => {
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
    },
  ];

  const defaultProps = {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: true,
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: vi.fn(),
    isSubmitting: false,
    selectedDate: '2026-07-26',
    onReservation: vi.fn(),
    onConfirmReservation: vi.fn().mockResolvedValue(true),
  };

  it('renders a loading skeleton when isUserDataLoading is true to prevent view flash', () => {
    render(<BookingForm {...defaultProps} isUserDataLoading={true} />);
    expect(screen.getByTestId('booking-form-skeleton')).toBeInTheDocument();
  });

  it('disables the submit button if selectedDate is null, or isSubmitting is true', () => {
    const { rerender } = render(
      <BookingForm {...defaultProps} selectedDate={null} />
    );
    const submitBtn = screen.getByRole('button', { name: '預約時間' });
    expect(submitBtn).toBeDisabled();

    rerender(<BookingForm {...defaultProps} isSubmitting={true} />);
    expect(screen.getByRole('button', { name: '處理中...' })).toBeDisabled();
  });

  it('disables the submit button if isAuthenticated is false', () => {
    render(<BookingForm {...defaultProps} isAuthenticated={false} />);
    const submitBtn = screen.getByRole('button', { name: '預約時間' });
    expect(submitBtn).toBeDisabled();
  });

  it('renders booking slots and the question input when not own profile', () => {
    render(<BookingForm {...defaultProps} />);

    // Renders slots
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    // Non-booked slot is a button
    const slotBtn = screen.getByRole('button', { name: /10:00/i });
    expect(slotBtn).toBeInTheDocument();

    // Booked slot has booked indicator / disabled
    const bookedSlotBtn = screen.getByRole('button', { name: /11:00/i });
    expect(bookedSlotBtn).toBeDisabled();

    // Renders question input
    expect(screen.getByLabelText('你想問導師的問題')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('請在此輸入你的問題...')
    ).toBeInTheDocument();
  });

  it('renders Loading state when monthLoaded is false', () => {
    render(<BookingForm {...defaultProps} monthLoaded={false} />);
    expect(screen.getByText('讀取中…')).toBeInTheDocument();
  });

  it('renders No Slots state when slots are empty', () => {
    render(<BookingForm {...defaultProps} slots={[]} />);
    expect(screen.getByText('無可預約的時段')).toBeInTheDocument();
  });

  it('disables the submit button if slot or question is missing (including test coverage gap)', async () => {
    const { rerender } = render(<BookingForm {...defaultProps} />);

    // Scenario 1: selectedSlot=null, bookingQuestion=""
    const submitBtn = screen.getByRole('button', { name: '預約時間' });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveClass('disabled:bg-background-border');
    expect(submitBtn).toHaveClass('disabled:text-text-disable');

    // Scenario 2: Select slot, and question is empty (now allowed)
    rerender(<BookingForm {...defaultProps} selectedSlot={mockSlots[0]} />);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '預約時間' })
      ).not.toBeDisabled();
    });

    // Scenario 3: [TEST GAP FIX] selectedSlot is null, but question is filled
    rerender(<BookingForm {...defaultProps} selectedSlot={null} />);
    const textarea = screen.getByPlaceholderText('請在此輸入你的問題...');
    fireEvent.change(textarea, { target: { value: 'How to learn TS?' } });
    expect(screen.getByRole('button', { name: '預約時間' })).toBeDisabled();

    // Scenario 4: [TEST GAP FIX] Select slot, but question is too long (> 1000 chars)
    rerender(<BookingForm {...defaultProps} selectedSlot={mockSlots[0]} />);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1001) } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '預約時間' })).toBeDisabled();
    });
  });

  it('enables the submit button, handles confirm, and resets the textarea on success', async () => {
    const onConfirmReservation = vi.fn().mockResolvedValue(true);
    render(
      <BookingForm
        {...defaultProps}
        selectedSlot={mockSlots[0]}
        onConfirmReservation={onConfirmReservation}
      />
    );

    const textarea = screen.getByPlaceholderText(
      '請在此輸入你的問題...'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'How to learn TS?' } });

    const submitBtn = screen.getByRole('button', { name: '預約時間' });
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onConfirmReservation).toHaveBeenCalledWith('How to learn TS?');
    });

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('displays validation error message when question is invalid (e.g. exceeds 1000 chars)', async () => {
    render(<BookingForm {...defaultProps} selectedSlot={mockSlots[0]} />);

    const textarea = screen.getByPlaceholderText('請在此輸入你的問題...');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1001) } });

    await waitFor(() => {
      expect(screen.getByText('問題字數請勿超過 1000 字')).toBeInTheDocument();
    });
  });

  it('renders config mode instead of booking mode when isOwnMentorProfile is true', () => {
    render(<BookingForm {...defaultProps} isOwnMentorProfile={true} />);

    // No question input
    expect(screen.queryByLabelText('你想問導師的問題')).not.toBeInTheDocument();

    // Slots are shown but not as buttons
    expect(
      screen.queryByRole('button', { name: /10:00/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();

    // Button text is "預約設定"
    const btn = screen.getByRole('button', { name: '預約設定' });
    expect(btn).toBeInTheDocument();
  });
});

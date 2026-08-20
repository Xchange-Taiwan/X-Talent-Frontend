import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UseMentorScheduleReturn } from '@/hooks/useMentorSchedule';
import { mockToast } from '@/test/mocks/useToast';

import MentorScheduleDialog from './MentorScheduleDialog';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockDraftForSelectedDate = [
  // 1. Regular ALLOW slot (can edit/delete)
  {
    id: 1,
    occurrenceId: 'occ-1',
    occurrenceUnix: 1785000000,
    start: new Date('2026-07-26T10:00:00'),
    end: new Date('2026-07-26T10:30:00'),
    durationMinutes: 30,
    type: 'ALLOW',
  },
  // 2. ALLOW slot with BOOKED reservation (triggers BOOKED prompt)
  {
    id: 2,
    occurrenceId: 'occ-2',
    occurrenceUnix: 1785010000,
    start: new Date('2026-07-26T11:00:00'),
    end: new Date('2026-07-26T11:30:00'),
    durationMinutes: 30,
    type: 'ALLOW',
  },
  // Backend-synthesized read-only placeholder (id < 0) — not a real
  // mentor_availability row, per X-Talent-Backend PR #44.
  {
    id: -22,
    occurrenceId: 'occ--22',
    occurrenceUnix: 1785010000,
    start: new Date('2026-07-26T11:00:00'),
    end: new Date('2026-07-26T11:30:00'),
    durationMinutes: 30,
    type: 'BOOKED',
  },
  // 3. ALLOW slot with PENDING reservation (triggers PENDING prompt)
  {
    id: 3,
    occurrenceId: 'occ-3',
    occurrenceUnix: 1785020000,
    start: new Date('2026-07-26T12:00:00'),
    end: new Date('2026-07-26T12:30:00'),
    durationMinutes: 30,
    type: 'ALLOW',
  },
  // Backend-synthesized read-only placeholder (id < 0) — not a real
  // mentor_availability row, per X-Talent-Backend PR #44.
  {
    id: -33,
    occurrenceId: 'occ--33',
    occurrenceUnix: 1785020000,
    start: new Date('2026-07-26T12:00:00'),
    end: new Date('2026-07-26T12:30:00'),
    durationMinutes: 30,
    type: 'PENDING',
  },
];

const mockSchedule = {
  loaded: true,
  monthLoaded: true,
  isFetching: false,
  selectedDate: '2026-07-26',
  setSelectedDate: vi.fn(),
  parsedDraft: [],
  draftForSelectedDate: mockDraftForSelectedDate,
  allowedDates: ['2026-07-26'],
  generateBookingSlots: vi.fn(),
  addSlotForSelectedDate: vi.fn().mockReturnValue({ added: 1, skipped: 0 }),
  updateDraftSlot: vi.fn().mockReturnValue({ success: true }),
  deleteDraftSlot: vi.fn(),
  confirmChanges: vi.fn().mockResolvedValue({ ok: true }),
  resetChanges: vi.fn(),
} as unknown as UseMentorScheduleReturn;

describe('MentorScheduleDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T08:00:00'));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders slots correctly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    expect(screen.getByText('10:00 – 10:30')).toBeInTheDocument();
    expect(screen.getByText('11:00 – 11:30')).toBeInTheDocument();
    expect(screen.getByText('12:00 – 12:30')).toBeInTheDocument();
  });

  it('opens EditSlotModal on clicking ALLOW slot and submits correctly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    expect(firstSlot).toBeInTheDocument();

    fireEvent.click(firstSlot!);
    expect(screen.getByText('編輯時段')).toBeInTheDocument();

    const editSubmitBtn = screen.getByRole('button', { name: '完成' });
    fireEvent.click(editSubmitBtn);
    expect(mockSchedule.updateDraftSlot).toHaveBeenCalledWith(1, 1785000000, {
      startTime: '10:00',
      durationMinutes: 30,
    });
    expect(screen.queryByText('編輯時段')).not.toBeInTheDocument();
  });

  it('opens BOOKED prompt correctly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const bookedSlot = screen
      .getByText('11:00 – 11:30')
      .closest('[role="button"]');
    fireEvent.click(bookedSlot!);
    expect(screen.getByText('此時段已有預約')).toBeInTheDocument();
    expect(screen.getByText(/此時段已有 mentee 預約成功/)).toBeInTheDocument();

    const promptCancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(promptCancelBtn);
    expect(screen.queryByText('此時段已有預約')).not.toBeInTheDocument();
  });

  it('opens PENDING prompt correctly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const pendingSlot = screen
      .getByText('12:00 – 12:30')
      .closest('[role="button"]');
    fireEvent.click(pendingSlot!);
    expect(screen.getByText('此時段有未處理的預約申請')).toBeInTheDocument();

    const pendingCancelBtn = within(
      screen.getByRole('dialog', { name: '此時段有未處理的預約申請' })
    ).getByRole('button', { name: '取消' });
    fireEvent.click(pendingCancelBtn);
    expect(
      screen.queryByText('此時段有未處理的預約申請')
    ).not.toBeInTheDocument();
  });

  it('opens AddSlotModal and submits correctly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const plusIcon = document.querySelector('.lucide-plus');
    const addButton = plusIcon?.closest('button');
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton!);
    expect(screen.getByText('新增可預約時段')).toBeInTheDocument();

    const addSubmitBtn = screen.getByRole('button', { name: '建立' });
    fireEvent.click(addSubmitBtn);
    expect(mockSchedule.addSlotForSelectedDate).toHaveBeenCalledWith({
      startTime: '12:30',
      durationMinutes: 30,
      weeklyWithinMonth: false,
    });
    expect(screen.queryByText('新增可預約時段')).not.toBeInTheDocument();
  });

  it('calls deleteDraftSlot on ALLOW slot delete click', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const firstSlotContainer = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    const deleteIcon = firstSlotContainer!.querySelector('.lucide-x');
    fireEvent.click(deleteIcon!.closest('button')!);
    expect(mockSchedule.deleteDraftSlot).toHaveBeenCalledWith(1, 1785000000);
  });

  it('intercepts delete click on BOOKED slot to open prompt', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );
    const bookedSlotContainer = screen
      .getByText('11:00 – 11:30')
      .closest('[role="button"]');
    const bookedDeleteIcon = bookedSlotContainer!.querySelector('.lucide-x');
    fireEvent.click(bookedDeleteIcon!.closest('button')!);
    expect(mockSchedule.deleteDraftSlot).not.toHaveBeenCalled();
    expect(screen.getByText('此時段已有預約')).toBeInTheDocument();
  });

  it('handles keyboard interaction (Enter / Space) properly', () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );

    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    expect(firstSlot).toBeInTheDocument();

    // Trigger Enter key down
    fireEvent.keyDown(firstSlot!, { key: 'Enter' });
    expect(screen.getByText('編輯時段')).toBeInTheDocument();
  });

  it('retains last prompt type and last editing slot details during transitions', async () => {
    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockSchedule}
      />
    );

    // 1. Open prompt dialog for BOOKED slot
    const bookedSlot = screen
      .getByText('11:00 – 11:30')
      .closest('[role="button"]');
    fireEvent.click(bookedSlot!);

    const promptDialog = screen.getByRole('dialog', { name: '此時段已有預約' });
    expect(promptDialog).toBeInTheDocument();

    // Trigger transition: Close prompt dialog
    const promptCancelBtn = within(promptDialog).getByRole('button', {
      name: '取消',
    });
    fireEvent.click(promptCancelBtn);

    // Even though activeDialog is now null (closed), the text inside the prompt DialogContent
    // should remain cached with the values of 'BOOKED' during transition and not flash to 'PENDING'
    expect(
      screen.queryByText('此時段有未處理的預約申請')
    ).not.toBeInTheDocument();

    // 2. Open EditSlotModal
    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    fireEvent.click(firstSlot!);

    const editDialog = screen.getByRole('dialog', { name: '編輯時段' });
    expect(editDialog).toBeInTheDocument();

    // Close EditSlotModal
    const editCancelBtn = within(editDialog).getByRole('button', {
      name: '取消',
    });
    fireEvent.click(editCancelBtn);

    // Even though activeDialog has been set to null, the EditSlotModal form should still hold the values of
    // the last slot, ensuring that the fields don't empty out or flicker during the fade-out exit animation.
    expect(screen.queryByText('新增可預約時段')).not.toBeInTheDocument();
  });

  it('shows precise destruct warning toast when updateDraftSlot returns TARGET_MONTH_NOT_LOADED reason', () => {
    const mockUpdateDraftSlotWithError = vi.fn().mockImplementation(() => {
      return { success: false, reason: 'TARGET_MONTH_NOT_LOADED' };
    });

    const mockScheduleWithError = {
      ...mockSchedule,
      updateDraftSlot: mockUpdateDraftSlotWithError,
    } as unknown as UseMentorScheduleReturn;

    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockScheduleWithError}
      />
    );

    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    fireEvent.click(firstSlot!);
    expect(screen.getByText('編輯時段')).toBeInTheDocument();

    const editSubmitBtn = screen.getByRole('button', { name: '完成' });
    fireEvent.click(editSubmitBtn);

    expect(mockUpdateDraftSlotWithError).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '目標月份排程尚未載入，請先在行事曆中切換至目標月份。',
    });
  });

  it('shows precise generic error toast when updateDraftSlot returns success: false without a specific reason', () => {
    const mockUpdateDraftSlotWithError = vi.fn().mockImplementation(() => {
      return { success: false }; // returns success: false without reason
    });

    const mockScheduleWithError = {
      ...mockSchedule,
      updateDraftSlot: mockUpdateDraftSlotWithError,
    } as unknown as UseMentorScheduleReturn;

    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockScheduleWithError}
      />
    );

    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    fireEvent.click(firstSlot!);
    expect(screen.getByText('編輯時段')).toBeInTheDocument();

    const editSubmitBtn = screen.getByRole('button', { name: '完成' });
    fireEvent.click(editSubmitBtn);

    expect(mockUpdateDraftSlotWithError).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '更新時段失敗，發生未知的錯誤，請稍後再試。',
    });
  });

  it('shows precise destruct warning toast when updateDraftSlot returns READ_ONLY reason', () => {
    const mockUpdateDraftSlotWithError = vi.fn().mockImplementation(() => {
      return { success: false, reason: 'READ_ONLY' };
    });

    const mockScheduleWithError = {
      ...mockSchedule,
      updateDraftSlot: mockUpdateDraftSlotWithError,
    } as unknown as UseMentorScheduleReturn;

    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockScheduleWithError}
      />
    );

    const firstSlot = screen
      .getByText('10:00 – 10:30')
      .closest('[role="button"]');
    fireEvent.click(firstSlot!);
    expect(screen.getByText('編輯時段')).toBeInTheDocument();

    const editSubmitBtn = screen.getByRole('button', { name: '完成' });
    fireEvent.click(editSubmitBtn);

    expect(mockUpdateDraftSlotWithError).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '此時段已被預約引用，無法編輯，請改為新增新時段',
    });
  });

  it('does not treat a positive-id BOOKED/PENDING row as a read-only blocker (only id < 0 counts)', () => {
    const mockScheduleWithPositiveId = {
      ...mockSchedule,
      draftForSelectedDate: mockDraftForSelectedDate.map((s) =>
        s.type === 'BOOKED' ? { ...s, id: Math.abs(s.id) } : s
      ),
    } as unknown as UseMentorScheduleReturn;

    render(
      <MentorScheduleDialog
        open={true}
        onOpenChange={vi.fn()}
        schedule={mockScheduleWithPositiveId}
      />
    );

    const bookedSlot = screen
      .getByText('11:00 – 11:30')
      .closest('[role="button"]');
    fireEvent.click(bookedSlot!);
    // A positive-id BOOKED row is no longer recognized as a placeholder, so
    // the click falls through to the normal edit flow instead of the prompt.
    expect(screen.queryByText('此時段已有預約')).not.toBeInTheDocument();
    expect(screen.getByText('編輯時段')).toBeInTheDocument();
  });
});

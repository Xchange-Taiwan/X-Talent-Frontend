import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { UseMentorScheduleReturn } from '@/hooks/useMentorSchedule';
import type { UserType } from '@/hooks/user/user-data/useUserData';

// next/image requires width/height derived from a static-import object shape
// that Vitest's asset transform doesn't produce; irrelevant to the
// role-resolution gating logic under test here.
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}));

// The reservation subtree pulls in dialogs/toasts/date logic unrelated to
// the flash-prevention gating this file tests - stub each with a marker so
// we can assert whether it rendered and inspect the props that matter here.
vi.mock('@/components/profile/reservation/BookingForm', () => ({
  BookingForm: ({ isUserDataLoading }: { isUserDataLoading: boolean }) => (
    <div data-testid="booking-form" data-loading={String(isUserDataLoading)} />
  ),
}));
vi.mock('@/components/profile/reservation/MentorScheduleDialog', () => ({
  default: () => <div data-testid="mentor-schedule-dialog" />,
}));
const scheduleCalendarMock = vi.hoisted(() => ({
  lastProps: null as { getDateStatus?: (date: Date) => unknown } | null,
}));
vi.mock('@/components/profile/reservation/ScheduleCalendar', () => ({
  ScheduleCalendar: (props: { getDateStatus?: (date: Date) => unknown }) => {
    scheduleCalendarMock.lastProps = props;
    return <div data-testid="schedule-calendar" />;
  },
}));

import ProfilePageUI from './ui';

function buildSchedule(): UseMentorScheduleReturn {
  return {
    loaded: true,
    monthLoaded: true,
    reservationsLoaded: true,
    isFetching: false,
    selectedDate: '2026-08-20',
    setSelectedDate: vi.fn(),
    parsedDraft: [],
    draftForSelectedDate: [],
    allowedDates: [],
    generateBookingSlots: vi.fn(() => []),
    slotsSnapshot: { slots: [], monthLoaded: true, reservationsLoaded: true },
    getDayBookingStatus: vi.fn(() => null),
    addSlotForSelectedDate: vi.fn(() => ({ added: 0, skipped: 0 })),
    updateDraftSlot: vi.fn(() => ({ success: true })),
    deleteDraftSlot: vi.fn(),
    confirmChanges: vi.fn(),
    resetChanges: vi.fn(),
    reservations: [],
  };
}

function buildUserData(overrides: Partial<UserType> = {}): UserType {
  return {
    user_id: 123,
    name: 'Test Mentor',
    avatar: 'https://example.com/avatar.png',
    job_title: 'Engineer',
    company: 'XChange',
    is_mentor: false,
    want_position: [],
    want_skill: [],
    want_topic: [],
    have_skill: [],
    have_topic: [],
    ...overrides,
  };
}

const noop = () => {};
const asyncNoop = async () => true;

function baseProps(
  overrides: Partial<React.ComponentProps<typeof ProfilePageUI>> = {}
) {
  const sched = buildSchedule();
  return {
    userData: buildUserData(),
    userLoading: false,
    schedule: sched,
    scheduleEditor: sched,
    scheduleLoaded: true,
    loginUserId: '',
    isIdentityResolved: false,
    canShowOwnerControls: false,
    avatarSrc: 'https://example.com/avatar.png',
    allowedDates: [],
    openReservationDialog: false,
    setOpenReservationDialog: noop,
    onScheduleMonthChange: noop,
    onReservation: noop,
    onEditProfile: noop,
    onBecomeMentor: noop,
    selectedSlot: null,
    setSelectedSlot: noop,
    isSubmitting: false,
    onConfirmReservation: asyncNoop,
    ...overrides,
  };
}

describe('ProfilePageUI - identity-resolution flash prevention', () => {
  it('renders neither owner-only button while canShowOwnerControls is false, even for the logged-in viewer', () => {
    render(<ProfilePageUI {...baseProps({ canShowOwnerControls: false })} />);

    expect(
      screen.queryByRole('button', { name: '編輯個人資訊' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '成為導師' })
    ).not.toBeInTheDocument();
  });

  it('renders the edit button once canShowOwnerControls is true for a mentor viewing their own profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          canShowOwnerControls: true,
        })}
      />
    );

    expect(
      screen.getByRole('button', { name: '編輯個人資訊' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '成為導師' })
    ).not.toBeInTheDocument();
  });

  it('renders the become-mentor button (alongside edit) once canShowOwnerControls is true for a mentee viewing their own profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: false }),
          canShowOwnerControls: true,
        })}
      />
    );

    expect(
      screen.getByRole('button', { name: '編輯個人資訊' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '成為導師' })
    ).toBeInTheDocument();
  });

  it('keeps BookingForm in its loading state while identity is still resolving, even once userData has loaded', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          userLoading: false,
          isIdentityResolved: false,
        })}
      />
    );

    expect(screen.getByTestId('booking-form')).toHaveAttribute(
      'data-loading',
      'true'
    );
  });

  it('lets BookingForm leave its loading state once both userData and identity have resolved', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          userLoading: false,
          isIdentityResolved: true,
        })}
      />
    );

    expect(screen.getByTestId('booking-form')).toHaveAttribute(
      'data-loading',
      'false'
    );
  });

  it('never mounts MentorScheduleDialog while canShowOwnerControls is false, regardless of openReservationDialog', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          isIdentityResolved: false,
          canShowOwnerControls: false,
          openReservationDialog: true,
        })}
      />
    );

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('mounts MentorScheduleDialog once canShowOwnerControls is true', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          isIdentityResolved: true,
          canShowOwnerControls: true,
        })}
      />
    );

    expect(screen.getByTestId('mentor-schedule-dialog')).toBeInTheDocument();
  });
});

describe('ProfilePageUI - calendar status-dot gating (#603)', () => {
  it('wires getDateStatus to schedule.getDayBookingStatus when the viewer owns the mentor profile', () => {
    const schedule = buildSchedule();
    (schedule.getDayBookingStatus as ReturnType<typeof vi.fn>).mockReturnValue(
      'PENDING'
    );

    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          canShowOwnerControls: true,
          schedule,
        })}
      />
    );

    const status = scheduleCalendarMock.lastProps?.getDateStatus?.(
      new Date(2026, 7, 20)
    );

    expect(status).toBe('PENDING');
    expect(schedule.getDayBookingStatus).toHaveBeenCalledWith('2026-08-20');
  });

  it('always returns null and never calls schedule.getDayBookingStatus when the viewer does not own the mentor profile', () => {
    const schedule = buildSchedule();

    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          canShowOwnerControls: false,
          schedule,
        })}
      />
    );

    const status = scheduleCalendarMock.lastProps?.getDateStatus?.(
      new Date(2026, 7, 20)
    );

    expect(status).toBeNull();
    expect(schedule.getDayBookingStatus).not.toHaveBeenCalled();
  });
});

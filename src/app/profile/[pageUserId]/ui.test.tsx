import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import type { BookingCalendarReader } from '@/lib/profile/bookingAvailability';

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
const scheduleCalendarMock = vi.hoisted(() => ({
  lastProps: null as { getDateStatus?: (date: Date) => unknown } | null,
}));
vi.mock('@/components/profile/reservation/ScheduleCalendar', () => ({
  ScheduleCalendar: (props: { getDateStatus?: (date: Date) => unknown }) => {
    scheduleCalendarMock.lastProps = props;
    return <div data-testid="schedule-calendar" />;
  },
}));

import { ProfilePageSkeleton } from './skeleton';
import ProfilePageUI from './ui';

function buildSchedule(): BookingCalendarReader {
  return {
    selectedDate: '2026-08-20',
    setSelectedDate: vi.fn(),
    allowedDates: [],
    slotsSnapshot: { slots: [], monthLoaded: true, reservationsLoaded: true },
    getDayBookingStatus: vi.fn(() => null),
    isFetching: false,
    reload: vi.fn(),
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
    scheduleLoaded: true,
    loginUserId: '',
    isIdentityResolved: false,
    canShowOwnerControls: false,
    avatarSrc: 'https://example.com/avatar.png',
    allowedDates: [],
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

  // Owner gating for the schedule editor now lives in container.tsx, which
  // decides whether to build the dialog at all (see container.test.tsx).
  // The UI's only contract is that it renders whatever editorDialog it is
  // handed, and renders nothing when handed none - asserting a role check
  // here would test a branch this component no longer owns.
  it('renders no schedule editor when the container withholds editorDialog', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          isIdentityResolved: true,
          canShowOwnerControls: true,
          editorDialog: undefined,
        })}
      />
    );

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('renders the editorDialog the container injected', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          isIdentityResolved: true,
          canShowOwnerControls: true,
          editorDialog: <div data-testid="mentor-schedule-dialog" />,
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

describe('ProfilePageUI - mentee-specific sections gating for mentor profiles (#598)', () => {
  it('displays the mentee sections on a mentee profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: false,
            want_position: [{ subject_group: 'role', subject: 'PM' }],
            want_skill: [{ subject_group: 'skill', subject: 'Figma' }],
            want_topic: [{ subject_group: 'topic', subject: 'Career' }],
          }),
        })}
      />
    );

    expect(screen.getByText('有興趣多了解的職位')).toBeInTheDocument();
    expect(screen.getByText('想多了解、加強的技能')).toBeInTheDocument();
    expect(screen.getByText('想多了解的主題')).toBeInTheDocument();
  });

  it('hides the mentee sections on a mentor profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            want_position: [{ subject_group: 'role', subject: 'PM' }],
            want_skill: [{ subject_group: 'skill', subject: 'Figma' }],
            want_topic: [{ subject_group: 'topic', subject: 'Career' }],
          }),
        })}
      />
    );

    expect(screen.queryByText('有興趣多了解的職位')).not.toBeInTheDocument();
    expect(screen.queryByText('想多了解、加強的技能')).not.toBeInTheDocument();
    expect(screen.queryByText('想多了解的主題')).not.toBeInTheDocument();
  });
});

describe('ProfilePageUI - BookingForm visibility', () => {
  it('hides BookingForm when schedule has an error', () => {
    const schedule = buildSchedule();
    schedule.hasError = true;
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true }),
          isIdentityResolved: true,
          schedule,
        })}
      />
    );
    expect(screen.queryByTestId('booking-form')).not.toBeInTheDocument();
  });
});

describe('ProfilePageUI & ProfilePageSkeleton - desktop two-column breakpoint (#803)', () => {
  it('applies xl two-column layout classes to the main profile container, left/right columns, and schedule card wrapper', () => {
    const { container } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: true, about: 'Mentor bio' }),
          isIdentityResolved: true,
        })}
      />
    );

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('max-w-screen-lg', 'xl:max-w-screen-xl');
    expect(mainContainer).not.toHaveClass('2xl:max-w-screen-xl');

    const aboutHeading = screen.getByText('關於我');
    const leftColumn = aboutHeading.closest('.w-full');
    expect(leftColumn).toHaveClass('xl:w-3/5');
    expect(leftColumn).not.toHaveClass('2xl:w-3/5');

    const columnsRow = leftColumn?.parentElement;
    expect(columnsRow).toHaveClass('flex-col', 'xl:flex-row', 'xl:gap-12');
    expect(columnsRow).not.toHaveClass('2xl:flex-row');

    const calendarCardHeading = screen.getByText('可預約日期');
    const dateHeading = calendarCardHeading.nextElementSibling;
    expect(dateHeading).toHaveClass('md:text-3xl', 'xl:text-2xl');
    expect(dateHeading).not.toHaveClass('2xl:text-2xl');

    const scheduleWrapper = screen
      .getByTestId('schedule-calendar')
      .closest('.max-w-\\[335px\\]');
    expect(scheduleWrapper).toHaveClass('md:max-w-[695px]', 'xl:max-w-[414px]');
    expect(scheduleWrapper).not.toHaveClass('2xl:max-w-[414px]');

    const rightColumn = scheduleWrapper?.parentElement;
    expect(rightColumn).toHaveClass('w-full', 'xl:w-2/5');
    expect(rightColumn).not.toHaveClass('2xl:w-2/5');
  });

  it('keeps ProfilePageSkeleton aligned with the xl two-column layout breakpoint', () => {
    const { container } = render(<ProfilePageSkeleton />);

    const mainContainer = container.querySelector('.container');
    expect(mainContainer).toHaveClass('max-w-screen-lg', 'xl:max-w-screen-xl');
    expect(mainContainer).not.toHaveClass('2xl:max-w-screen-xl');

    const columnsRow = mainContainer?.querySelector('.xl\\:flex-row');
    expect(columnsRow).toBeInTheDocument();
    expect(columnsRow).toHaveClass('xl:gap-12');
    expect(mainContainer?.querySelector('.xl\\:w-3\\/5')).toBeInTheDocument();
    expect(mainContainer?.querySelector('.xl\\:w-2\\/5')).toBeInTheDocument();
  });
});

describe('ProfilePageUI - multiline text whitespace preservation (#857)', () => {
  it('applies whitespace-pre-line and break-words to about, personal_statement, and work experience description', () => {
    const multilineAbout = '第一段自我介紹\n1. 產品策略\n2. 系統架構';
    const multilineStatement = '給導生的話第一行\n1. 請先準備問題\n2. 歡迎交流';
    const multilineJobDesc = '負責核心系統研發\n1. 帶領團隊重構\n2. 提升效能';

    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: multilineAbout,
            personal_statement: multilineStatement,
            workExperiences: [
              {
                job: 'Senior Engineer',
                company: 'XChange',
                job_period_start: '2022',
                job_period_end: '2025',
                job_location: 'TWN',
                industry: 'TECH',
                is_primary: true,
                description: multilineJobDesc,
              },
            ],
          }),
          isIdentityResolved: true,
        })}
      />
    );

    const aboutHeading = screen.getByText('關於我');
    const aboutParagraph = aboutHeading.nextElementSibling;
    expect(aboutParagraph).toHaveClass('whitespace-pre-line', 'break-words');
    expect(aboutParagraph?.textContent).toBe(multilineAbout);

    const statementHeading = screen.getByText('給導生的話');
    const statementParagraph = statementHeading.nextElementSibling;
    expect(statementParagraph).toHaveClass(
      'whitespace-pre-line',
      'break-words'
    );
    expect(statementParagraph?.textContent).toBe(multilineStatement);

    const jobTitleHeading = screen.getByRole('heading', {
      name: 'Senior Engineer',
    });
    const jobDescParagraph = jobTitleHeading.nextElementSibling;
    expect(jobDescParagraph).toHaveClass('whitespace-pre-line', 'break-words');
    expect(jobDescParagraph?.textContent).toBe(multilineJobDesc);
  });
});

describe('ProfilePageUI - mentor stats summary & reviews tab (#736)', () => {
  it('renders summary stats and switches between 簡介 and 評價 N tabs while keeping summary fixed', async () => {
    const user = userEvent.setup();
    const setPage = vi.fn();
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '導師自我介紹內容',
            stats: {
              completed_meeting_count: 128,
              rating_count: 12,
              rating_average: 8.5,
            },
          }),
          isIdentityResolved: true,
          feedback: {
            items: [
              {
                id: 'fb-1',
                authorName: '陳**',
                authorInitial: '陳',
                rating: 9,
                content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
                createdAt: '2026-10-28T12:00:00Z',
                formattedDate: '2026/10/28',
              },
            ],
            totalRatingCount: 12,
            page: 1,
            pageSize: 10,
            totalPages: 2,
            ratingAverage: 8.5,
            completedMeetingCount: 128,
            isFallback: false,
            isLoading: false,
            hasError: false,
            setPage,
            retry: vi.fn(),
          },
        })}
      />
    );

    // Summary bar shows rating and completed sessions
    const summarySection = screen.getByRole('region', { name: '導師會談摘要' });
    expect(summarySection).toHaveTextContent('8.5');
    expect(summarySection).toHaveTextContent('128');

    // Tabs render with space-separated count in title
    const aboutTab = screen.getByRole('tab', { name: '簡介' });
    const reviewsTab = screen.getByRole('tab', { name: '評價 12' });
    expect(aboutTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('導師自我介紹內容')).toBeInTheDocument();

    await user.click(reviewsTab);
    expect(reviewsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('12 則會談評價')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '導師會談摘要' })
    ).toBeInTheDocument();
  });

  it('displays review items and pagination when defaultActiveTab is reviews, and neutral empty state when 0 reviews', () => {
    const setPage = vi.fn();
    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 128,
              rating_count: 12,
              rating_average: 8.5,
            },
          }),
          defaultActiveTab: 'reviews',
          feedback: {
            items: [
              {
                id: 'fb-1',
                authorName: '陳**',
                authorInitial: '陳',
                rating: 9,
                content: '分享了很具體的建議',
                createdAt: '2026-10-28',
                formattedDate: '2026/10/28',
              },
            ],
            totalRatingCount: 12,
            page: 1,
            pageSize: 10,
            totalPages: 2,
            ratingAverage: 8.5,
            completedMeetingCount: 128,
            isFallback: false,
            isLoading: false,
            hasError: false,
            setPage,
            retry: vi.fn(),
          },
        })}
      />
    );

    expect(screen.getByText('12 則會談評價')).toBeInTheDocument();
    expect(screen.getByText('陳**')).toBeInTheDocument();
    screen.getByRole('button', { name: '下一頁' }).click();
    expect(setPage).toHaveBeenCalledWith(2);

    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 0,
              rating_count: 0,
              rating_average: null,
            },
          }),
          defaultActiveTab: 'reviews',
          feedback: {
            items: [],
            totalRatingCount: 0,
            page: 1,
            pageSize: 10,
            totalPages: 0,
            ratingAverage: null,
            completedMeetingCount: 0,
            isFallback: false,
            isLoading: false,
            hasError: false,
            setPage,
            retry: vi.fn(),
          },
        })}
      />
    );

    expect(screen.getByRole('tab', { name: '評價 0' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '導師會談摘要' })
    ).toBeInTheDocument();
    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();
    expect(
      screen.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeInTheDocument();
  });

  it('keeps summary bar fixed across tabs when 0 sessions and 0 reviews, and avoids mentee-only copy on MentorOwnerView', async () => {
    const user = userEvent.setup();
    const zeroFeedback = {
      items: [],
      totalRatingCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      ratingAverage: null,
      completedMeetingCount: 0,
      isFallback: false,
      isLoading: false,
      hasError: false,
      setPage: vi.fn(),
      retry: vi.fn(),
    };

    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 0,
              rating_count: 0,
              rating_average: null,
            },
          }),
          isIdentityResolved: false,
          canShowOwnerControls: false,
          feedback: zeroFeedback,
        })}
      />
    );

    // While identity is unsettled, withhold role-specific empty copy to prevent flash
    expect(
      screen.getByRole('region', { name: '導師會談摘要' })
    ).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByText(/您可以成為第一個預約的 Mentee/)
    ).not.toBeInTheDocument();

    // Settled visitor sees the mentee booking prompt across tab switches
    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 0,
              rating_count: 0,
              rating_average: null,
            },
          }),
          isIdentityResolved: true,
          canShowOwnerControls: false,
          feedback: zeroFeedback,
        })}
      />
    );

    expect(
      screen.getByText('尚未有任何評價，您可以成為第一個預約的 Mentee！')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '評價 0' }));
    expect(
      screen.getByRole('region', { name: '導師會談摘要' })
    ).toBeInTheDocument();
    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();

    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 0,
              rating_count: 0,
              rating_average: null,
            },
          }),
          isIdentityResolved: true,
          canShowOwnerControls: true,
          feedback: zeroFeedback,
        })}
      />
    );

    expect(
      screen.queryByText(/您可以成為第一個預約的 Mentee/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('目前尚無已完成會談與評價紀錄')
    ).toBeInTheDocument();
    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();
  });

  it('does not render mentor summary bar or review tabs on mentee profiles', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({ is_mentor: false }),
        })}
      />
    );

    expect(
      screen.queryByRole('region', { name: '導師會談摘要' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /評價/ })).not.toBeInTheDocument();
  });
});

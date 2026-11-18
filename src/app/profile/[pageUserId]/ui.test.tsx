import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionContext, type SessionContextValue } from 'next-auth/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { UserType } from '@/hooks/user/user-data/useUserData';
import {
  favoriteMentorsReadModel,
  resetFavoriteMentorsReadModel,
} from '@/lib/favorites';
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

const defaultGuestSession: SessionContextValue = {
  data: null,
  status: 'unauthenticated',
  update: async () => null,
};

function DefaultGuestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={defaultGuestSession}>
      {children}
    </SessionContext.Provider>
  );
}

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: DefaultGuestWrapper });
}

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

  it('renders only the edit button (without become-mentor) once canShowOwnerControls is true for a mentee viewing their own profile (#960)', () => {
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
      screen.queryByRole('button', { name: '成為導師' })
    ).not.toBeInTheDocument();
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

describe('ProfilePageUI - mentee B-1 v2 display sections and mentor gating (#598 / #960)', () => {
  it('displays B-1 summary bar, #industry hashtag, per-direction preference tabs, and right-column watched positions card on a mentee profile', async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageUI
        {...baseProps({
          storedDirectionMap: {
            uiux: { skills: ['ux_research'], topics: ['portfolio'] },
            fe: { skills: ['react'], topics: ['career'] },
          },
          userData: buildUserData({
            user_id: 123,
            is_mentor: false,
            avatar: '',
            job_title: 'Product Designer',
            company: 'Flow Studio',
            about: '喜歡透過研究理解使用者需求。',
            industry: '設計及創意相關業',
            years_of_experience: '1~3 年',
            location: '臺灣',
            workExperiences: [
              {
                job: 'Product Designer',
                company: 'Flow Studio',
                job_period_start: '2024',
                job_period_end: '至今',
                industry: '設計及創意相關業',
                job_location: '臺灣',
                description: '設計流程改善',
                is_primary: true,
              },
            ],
            personalLinks: [
              { platform: 'linkedin', url: 'https://www.linkedin.com/in/xh' },
              { platform: 'github', url: 'https://github.com/xh' },
            ],
            want_position: [
              { subject_group: 'uiux', subject: '產品設計／UIUX' },
              { subject_group: 'fe', subject: '前端工程' },
            ],
            want_skill: [
              { subject_group: 'ux_research', subject: 'UX Research' },
              { subject_group: 'react', subject: 'React' },
            ],
            want_topic: [
              { subject_group: 'portfolio', subject: '作品集檢視' },
              { subject_group: 'career', subject: '職涯規劃' },
            ],
          }),
        })}
      />
    );

    expect(screen.getAllByText(/Product Designer/)[0]).toHaveTextContent(
      'Product Designer at Flow Studio'
    );
    expect(screen.getByAltText('Avatar of Test Mentor')).toHaveAttribute(
      'src',
      '/avatars/default_1.webp'
    );
    expect(screen.getByText('個人連結')).toBeInTheDocument();
    const ghLink = screen.getByRole('link', { name: 'GitHub' });
    expect(ghLink).toHaveAttribute(
      'data-analytics-location',
      'profile_links_section'
    );
    expect(
      document.querySelector('[data-analytics-location="profile_header"] a')
    ).toBeNull();
    const summaryGrid = screen.getByTestId('mentee-summary-grid');
    expect(within(summaryGrid).getByText('經驗')).toBeInTheDocument();
    expect(within(summaryGrid).getByText('地點')).toBeInTheDocument();
    expect(within(summaryGrid).getByText('探索方向')).toBeInTheDocument();
    expect(within(summaryGrid).getByText('個職位方向')).toBeInTheDocument();

    expect(screen.getByTestId('mentee-industry-hashtag')).toHaveTextContent(
      '#設計及創意相關業'
    );
    expect(screen.getByText('交流偏好')).toBeInTheDocument();
    expect(screen.getByText('想加強的技能')).toBeInTheDocument();
    expect(screen.getByText('想了解的主題')).toBeInTheDocument();
    expect(screen.getByText('UX Research')).toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();

    const watchedCard = screen.getByTestId('mentee-watched-positions-card');
    expect(within(watchedCard).getByText('關注的職位')).toBeInTheDocument();
    expect(
      within(watchedCard).getAllByText('1 項技能 · 1 個主題')
    ).toHaveLength(2);

    // Switch direction via right-column watched positions card button (#960)
    const feWatchBtn = within(watchedCard).getByRole('button', {
      name: /前端工程/,
    });
    await user.click(feWatchBtn);
    expect(feWatchBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('職涯規劃')).toBeInTheDocument();
  });

  it('preserves legacy skills/topics when want_position is empty, shows empty-direction message, and resets stored map across user_id changes (#960)', async () => {
    const user = userEvent.setup();

    // 1. Legacy Mentee: want_position=[] with non-empty want_skill / want_topic
    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            user_id: 301,
            is_mentor: false,
            want_position: [],
            want_skill: [{ subject_group: 'figma', subject: 'Figma' }],
            want_topic: [{ subject_group: 'resume', subject: '履歷健檢' }],
          }),
        })}
      />
    );

    expect(
      screen.queryByTestId('mentee-profile-empty-state')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.getByText('履歷健檢')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('mentee-watched-positions-card')).getByText(
        '尚未選擇職位'
      )
    ).toBeInTheDocument();

    // 2. Mentee with two positions where second direction has 0 skills/topics
    rerender(
      <ProfilePageUI
        {...baseProps({
          storedDirectionMap: {
            uiux: { skills: ['figma'], topics: [] },
            pm: { skills: [], topics: [] },
          },
          userData: buildUserData({
            user_id: 302,
            is_mentor: false,
            want_position: [
              { subject_group: 'uiux', subject: '產品設計' },
              { subject_group: 'pm', subject: '產品經理' },
            ],
            want_skill: [{ subject_group: 'figma', subject: 'Figma' }],
            want_topic: [],
          }),
        })}
      />
    );

    await user.click(screen.getByRole('tab', { name: /產品經理/ }));
    expect(screen.getByText('尚未設定此方向的技能與主題')).toBeInTheDocument();
  });

  it('loads stored direction map from window.localStorage in production mode and resets cleanly across user_id changes (#960)', () => {
    window.localStorage.setItem(
      'xtalent:mentee-direction-map:v1:701',
      JSON.stringify({
        uiux: { skills: [], topics: [] },
        fe: { skills: ['react'], topics: [] },
      })
    );

    try {
      const { rerender } = render(
        <ProfilePageUI
          {...baseProps({
            userData: buildUserData({
              user_id: 701,
              is_mentor: false,
              workExperiences: [],
              want_position: [
                { subject_group: 'uiux', subject: '產品設計' },
                { subject_group: 'fe', subject: '前端工程' },
              ],
              want_skill: [{ subject_group: 'react', subject: 'React' }],
              want_topic: [],
            }),
          })}
        />
      );

      expect(screen.queryByText(/Engineer/)).not.toBeInTheDocument();
      expect(
        screen.getByText('尚未設定此方向的技能與主題')
      ).toBeInTheDocument();

      rerender(
        <ProfilePageUI
          {...baseProps({
            userData: buildUserData({
              user_id: 702,
              is_mentor: false,
              want_position: [
                { subject_group: 'uiux', subject: '產品設計' },
                { subject_group: 'fe', subject: '前端工程' },
              ],
              want_skill: [{ subject_group: 'react', subject: 'React' }],
              want_topic: [],
            }),
          })}
        />
      );

      expect(screen.getByText('React')).toBeInTheDocument();
    } finally {
      window.localStorage.clear();
    }
  });

  it('displays empty-state cards when Mentee optional profile fields are all empty (#960)', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: false,
            job_title: '',
            company: '',
            about: '',
            industry: '',
            years_of_experience: '',
            location: '',
            want_position: [],
            want_skill: [],
            want_topic: [],
            workExperiences: [],
            educations: [],
            personalLinks: [],
          }),
        })}
      />
    );

    expect(screen.queryByTestId('mentee-summary-grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('mentee-profile-empty-state')).toHaveTextContent(
      '尚未填寫個人資料'
    );
    expect(
      within(screen.getByTestId('mentee-watched-positions-card')).getByText(
        '尚未選擇職位'
      )
    ).toBeInTheDocument();
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

    expect(screen.queryByText('交流偏好')).not.toBeInTheDocument();
    expect(screen.queryByText('想加強的技能')).not.toBeInTheDocument();
    expect(screen.queryByText('想了解的主題')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('mentee-watched-positions-card')
    ).not.toBeInTheDocument();
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

describe('ProfilePageUI - mentor summary bar and feedback tabs (#736)', () => {
  it('renders full-width 4-cell summary bar without industry row, renders #hashtag under 關於我 above self-intro, and switches between 簡介 and 評價 N tabs while keeping booking panel visible (#736)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '關於導師的介紹文字',
            years_of_experience: '5~10 年',
            location: '台灣',
            industry: '設計及創意相關業',
            industries: [
              { subject_group: 'design', subject: '設計及創意相關業' },
            ],
            stats: {
              completed_meeting_count: 128,
              rating_count: 12,
              rating_average: 8.5,
            },
          }),
          feedback: {
            items: [
              {
                id: 'fb-1',
                authorName: '陳**',
                rating: 9,
                content: '分享了很具體的建議，也幫助我釐清下一步的方向。',
                createdAt: '2026-10-28T10:00:00Z',
              },
            ],
            totalRatingCount: 12,
            ratingAverage: 8.5,
            page: 1,
            pageSize: 10,
            hasLoaded: true,
            isLoading: false,
            error: null,
          },
          isIdentityResolved: true,
        })}
      />
    );

    const summaryRegion = screen.getByRole('region', { name: '導師摘要資訊' });
    expect(summaryRegion).toBeInTheDocument();
    expect(within(summaryRegion).queryByText('產業')).not.toBeInTheDocument();
    expect(
      within(summaryRegion).queryByText(/設計及創意相關業/)
    ).not.toBeInTheDocument();

    const aboutPanel = screen.getByRole('tabpanel', { name: '簡介' });
    const aboutHeading = within(aboutPanel).getByText('關於我');
    const hashtagEl = within(aboutPanel).getByTestId('mentor-industry-hashtag');
    const aboutBody = within(aboutPanel).getByText('關於導師的介紹文字');

    expect(aboutHeading).toHaveClass('mb-3', 'text-xl', 'font-bold');
    expect(hashtagEl).toHaveTextContent('#設計及創意相關業');
    expect(hashtagEl).toHaveClass(
      'text-brand-700',
      'text-sm',
      'font-medium',
      'mb-3'
    );
    expect(aboutHeading.nextElementSibling).toBe(hashtagEl);
    expect(hashtagEl.nextElementSibling).toBe(aboutBody);
    expect(aboutPanel).not.toHaveTextContent('經驗');
    expect(within(aboutPanel).queryByText('產業')).not.toBeInTheDocument();
    expect(screen.getByText('可預約日期')).toBeInTheDocument();

    const feedbackTab = screen.getByRole('tab', { name: /評價\s*12/ });
    await user.click(feedbackTab);

    expect(screen.getByText('12 則會談評價')).toBeInTheDocument();
    expect(
      screen.getByText('分享了很具體的建議，也幫助我釐清下一步的方向。')
    ).toBeInTheDocument();
    expect(screen.getByText('可預約日期')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-calendar')).toBeInTheDocument();
  });

  it('normalizes leading # in mentor industry and falls back to industries[0] when industry string is empty (#736)', () => {
    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '自我介紹',
            industry: '##軟體及網路相關業',
          }),
          isIdentityResolved: true,
        })}
      />
    );

    expect(screen.getByTestId('mentor-industry-hashtag')).toHaveTextContent(
      '#軟體及網路相關業'
    );

    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '自我介紹',
            industry: '',
            industries: [
              { subject_group: 'design', subject: '設計及創意相關業' },
            ],
          }),
          isIdentityResolved: true,
        })}
      />
    );

    expect(screen.getByTestId('mentor-industry-hashtag')).toHaveTextContent(
      '#設計及創意相關業'
    );
  });

  it('renders 關於我 with #hashtag (without empty bio paragraph) and keeps mt-10 on 給導生的話 when mentor about is empty, and hides 關於我 when industry contains only # and whitespace (#736)', () => {
    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '',
            industry: '設計及創意相關業',
            personal_statement: '歡迎帶著作品集來交流',
          }),
          isIdentityResolved: true,
        })}
      />
    );

    const aboutPanel = screen.getByRole('tabpanel', { name: '簡介' });
    const aboutHeading = within(aboutPanel).getByText('關於我');
    const hashtagEl = within(aboutPanel).getByTestId('mentor-industry-hashtag');
    expect(aboutHeading).toBeInTheDocument();
    expect(hashtagEl).toHaveTextContent('#設計及創意相關業');
    expect(hashtagEl).not.toHaveClass('mb-3');
    expect(hashtagEl.nextElementSibling).toBeNull();

    const statementHeading = within(aboutPanel).getByText('給導生的話');
    expect(statementHeading.parentElement).toHaveClass('mt-10');

    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '',
            industry: '###   ',
            personal_statement: '歡迎帶著作品集來交流',
          }),
          isIdentityResolved: true,
        })}
      />
    );

    expect(
      within(aboutPanel).queryByTestId('mentor-industry-hashtag')
    ).not.toBeInTheDocument();
    expect(within(aboutPanel).queryByText('關於我')).not.toBeInTheDocument();
    const updatedStatementHeading = within(aboutPanel).getByText('給導生的話');
    expect(updatedStatementHeading.parentElement).not.toHaveClass('mt-10');
  });

  it('hides both rating and completed 1-on-1 cells when both are 0 and shows empty state in 評價 0 tab (#736)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            years_of_experience: '5~10 年',
            location: '台灣',
            stats: {
              completed_meeting_count: 0,
              rating_count: 0,
              rating_average: null,
            },
          }),
          feedback: {
            items: [],
            totalRatingCount: 0,
            ratingAverage: null,
            completedMeetingCount: 0,
            hasLoaded: true,
            isLoading: false,
            error: null,
          },
          isIdentityResolved: true,
        })}
      />
    );

    const summaryRegion = screen.getByRole('region', { name: '導師摘要資訊' });
    expect(within(summaryRegion).queryByText('評分')).not.toBeInTheDocument();
    expect(
      within(summaryRegion).queryByText('已完成 1-on-1')
    ).not.toBeInTheDocument();
    expect(within(summaryRegion).getByText('經驗')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('地點')).toBeInTheDocument();

    const feedbackTab = screen.getByRole('tab', { name: /評價\s*0/ });
    await user.click(feedbackTab);

    expect(screen.getByText('目前還沒有評價')).toBeInTheDocument();
    expect(
      screen.getByText('完成會談後，學員的評價會顯示在這裡。')
    ).toBeInTheDocument();
  });

  it('independently hides only rating cell when rating_count is 0 or only completed 1-on-1 cell when completed_meeting_count is 0 (#736)', () => {
    const { rerender } = render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            years_of_experience: '5~10 年',
            location: '台灣',
            stats: {
              completed_meeting_count: 25,
              rating_count: 0,
              rating_average: null,
            },
          }),
          feedback: {
            items: [],
            totalRatingCount: 0,
            ratingAverage: null,
            completedMeetingCount: 25,
            hasLoaded: true,
            isLoading: false,
            error: null,
          },
          isIdentityResolved: true,
        })}
      />
    );

    const summaryRegion = screen.getByRole('region', { name: '導師摘要資訊' });
    expect(within(summaryRegion).queryByText('評分')).not.toBeInTheDocument();
    expect(
      within(summaryRegion).getByText('已完成 1-on-1')
    ).toBeInTheDocument();
    expect(within(summaryRegion).getByText('25')).toBeInTheDocument();

    rerender(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            years_of_experience: '5~10 年',
            location: '台灣',
            stats: {
              completed_meeting_count: 0,
              rating_count: 6,
              rating_average: 9.0,
            },
          }),
          feedback: {
            items: [
              {
                id: 'fb-solo',
                authorName: '林**',
                rating: 9,
                content: '建議很具體。',
                createdAt: '2026-10-28T10:00:00Z',
              },
            ],
            totalRatingCount: 6,
            ratingAverage: 9.0,
            completedMeetingCount: 0,
            hasLoaded: true,
            isLoading: false,
            error: null,
          },
          isIdentityResolved: true,
        })}
      />
    );

    expect(within(summaryRegion).getByText('評分')).toBeInTheDocument();
    expect(within(summaryRegion).getByText('9.0')).toBeInTheDocument();
    expect(
      within(summaryRegion).queryByText('已完成 1-on-1')
    ).not.toBeInTheDocument();
  });

  it('does not render mentor summary bar or feedback tabs on a mentee profile (is_mentor: false) (#736)', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: false,
            about: '學員自我介紹',
            years_of_experience: '1~3 年',
            industry: '軟體及網路相關業',
          }),
          isIdentityResolved: true,
        })}
      />
    );

    expect(
      screen.queryByRole('region', { name: '導師摘要資訊' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: '導師頁面分頁' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('mentor-feedback-section')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('mentor-industry-hashtag')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('mentee-industry-hashtag')).toHaveTextContent(
      '#軟體及網路相關業'
    );
    expect(screen.getByText('學員自我介紹')).toBeInTheDocument();
  });

  it('keeps feedback strictly read-only when mentor views their own profile (canShowOwnerControls: true) (#736)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 18,
              rating_count: 2,
              rating_average: 8.5,
            },
          }),
          feedback: {
            items: [
              {
                id: 'fb-owner-1',
                authorName: '陳**',
                rating: 9,
                content: '導師給予非常實用的職涯方向建議。',
                createdAt: '2026-10-28T10:00:00Z',
              },
            ],
            totalRatingCount: 2,
            ratingAverage: 8.5,
            hasLoaded: true,
            isLoading: false,
            error: null,
          },
          loginUserId: '123',
          isIdentityResolved: true,
          canShowOwnerControls: true,
        })}
      />
    );

    expect(
      screen.getByRole('button', { name: '編輯個人資訊' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /評價\s*2/ }));

    const feedbackSection = screen.getByTestId('mentor-feedback-section');
    expect(
      within(feedbackSection).getByText('導師給予非常實用的職涯方向建議。')
    ).toBeInTheDocument();
    expect(
      within(feedbackSection).queryByRole('button', {
        name: /修改|編輯|刪除|回覆|檢舉/,
      })
    ).not.toBeInTheDocument();
  });

  it('preserves SSR userData.stats and shows unavailable prompt without pagination when feedback endpoint returns 404 fallback empty state (#736)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            stats: {
              completed_meeting_count: 64,
              rating_count: 12,
              rating_average: 9.2,
            },
          }),
          feedback: {
            items: [],
            totalRatingCount: 0,
            ratingAverage: null,
            completedMeetingCount: null,
            hasLoaded: true,
            isFallbackEmpty: true,
            isLoading: false,
            error: null,
          },
          isIdentityResolved: true,
        })}
      />
    );

    expect(screen.getByText('9.2')).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();

    const feedbackTab = screen.getByRole('tab', { name: /評價\s*12/ });
    expect(feedbackTab).toBeInTheDocument();
    await user.click(feedbackTab);

    const feedbackSection = screen.getByTestId('mentor-feedback-section');
    expect(within(feedbackSection).getByText('9.2')).toBeInTheDocument();
    expect(
      within(feedbackSection).getByText('12 則會談評價')
    ).toBeInTheDocument();
    expect(
      within(feedbackSection).getByText('目前暫無法顯示評價內容，請稍後再試。')
    ).toBeInTheDocument();
    expect(
      within(feedbackSection).queryByRole('list', { name: '會談評價列表' })
    ).not.toBeInTheDocument();
    expect(
      within(feedbackSection).queryByRole('navigation', { name: '評價分頁' })
    ).not.toBeInTheDocument();
    expect(
      within(feedbackSection).queryByRole('combobox', { name: '評價排序' })
    ).not.toBeInTheDocument();
  });
});

describe('ProfilePageUI - mentor bookmark button gating (#758)', () => {
  it('renders the bookmark button for a visitor viewing a mentor profile without Email/notification copy', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            user_id: 123,
            name: 'Zahra Mirzakhani',
            is_mentor: true,
          }),
          loginUserId: '999',
          isIdentityResolved: true,
          canShowOwnerControls: false,
        })}
      />
    );

    const bookmarkBtn = screen.getByRole('button', {
      name: '收藏 Zahra Mirzakhani',
    });
    expect(bookmarkBtn).toBeInTheDocument();
    expect(bookmarkBtn.textContent).toBe('');
    expect(screen.queryByText(/新時段通知/)).not.toBeInTheDocument();
  });

  it('hides the bookmark button on the mentor owner profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            user_id: 123,
            name: 'Zahra Mirzakhani',
            is_mentor: true,
          }),
          loginUserId: '123',
          isIdentityResolved: true,
          canShowOwnerControls: true,
        })}
      />
    );

    expect(
      screen.queryByRole('button', { name: /收藏 Zahra Mirzakhani/ })
    ).not.toBeInTheDocument();
  });

  it('hides the bookmark button on a non-mentor profile', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            user_id: 456,
            name: 'Alex Mentee',
            is_mentor: false,
          }),
          loginUserId: '999',
          isIdentityResolved: true,
          canShowOwnerControls: false,
        })}
      />
    );

    expect(
      screen.queryByRole('button', { name: /收藏 Alex Mentee/ })
    ).not.toBeInTheDocument();
  });

  it('withholds the bookmark button while identity is still resolving', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            user_id: 123,
            name: 'Zahra Mirzakhani',
            is_mentor: true,
          }),
          loginUserId: '',
          isIdentityResolved: false,
          canShowOwnerControls: false,
        })}
      />
    );

    expect(
      screen.queryByRole('button', { name: /收藏 Zahra Mirzakhani/ })
    ).not.toBeInTheDocument();
  });

  it('stores a complete mentorSnapshot in favoriteMentorsReadModel when toggling bookmark from profile page (#757 / #908)', async () => {
    resetFavoriteMentorsReadModel();
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
      addFavoriteMentor: vi.fn().mockResolvedValue(undefined),
      removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
    });
    favoriteMentorsReadModel.seed('999', []);

    const sessionContextValue: SessionContextValue = {
      data: {
        user: {
          id: '999',
          email: 'mentee@example.com',
          name: 'Mentee Viewer',
          onBoarding: true,
          isMentor: false,
        },
        accessToken: 'mock-token',
        expires: '2099-01-01T00:00:00.000Z',
      },
      status: 'authenticated',
      update: async () => null,
    };

    try {
      const user = userEvent.setup();
      render(
        <SessionContext.Provider value={sessionContextValue}>
          <ProfilePageUI
            {...baseProps({
              userData: buildUserData({
                user_id: 123,
                name: 'Zahra Mirzakhani',
                job_title: 'Senior UX Designer',
                company: 'CreativeUX Design Studio',
                is_mentor: true,
                have_topic: [{ subject_group: 'CAREER', subject: '職涯規劃' }],
              }),
              loginUserId: '999',
              isIdentityResolved: true,
              canShowOwnerControls: false,
            })}
          />
        </SessionContext.Provider>
      );

      await user.click(
        screen.getByRole('button', { name: '收藏 Zahra Mirzakhani' })
      );

      await waitFor(() => {
        expect(
          favoriteMentorsReadModel.getMentorState('999', 123).isFavorited
        ).toBe(true);
      });
      const storedMentor =
        favoriteMentorsReadModel.getSnapshot('999')?.mentors[0];
      expect(storedMentor).toMatchObject({
        user_id: 123,
        name: 'Zahra Mirzakhani',
        job_title: 'Senior UX Designer',
        company: 'CreativeUX Design Studio',
        have_topic: ['CAREER'],
      });
      expect(storedMentor?.avatar).toBeTruthy();
    } finally {
      resetFavoriteMentorsReadModel();
    }
  });
});

describe('ProfilePageUI - personal links with GitHub (#862)', () => {
  it.each([false, true])(
    'renders GitHub between YouTube and 個人網站 alongside Facebook as external links when is_mentor=%s',
    (isMentor) => {
      render(
        <ProfilePageUI
          {...baseProps({
            userData: buildUserData({
              is_mentor: isMentor,
              personalLinks: [
                { platform: 'website', url: 'https://portfolio.dev' },
                { platform: 'github', url: 'https://github.com/octocat' },
                { platform: 'github', url: 'https://gitlab.com/imposter' },
                { platform: 'youtube', url: 'https://youtube.com/@octocat' },
                {
                  platform: 'facebook',
                  url: 'https://www.facebook.com/octocat',
                },
              ],
            }),
            isIdentityResolved: true,
          })}
        />
      );

      const links = screen.getAllByRole('link');
      expect(links.map((el) => el.getAttribute('aria-label'))).toEqual([
        'Facebook',
        'YouTube',
        'GitHub',
        '個人網站',
      ]);

      const githubLink = screen.getByRole('link', { name: 'GitHub' });
      expect(githubLink).toHaveAttribute('href', 'https://github.com/octocat');
      expect(githubLink).toHaveAttribute('target', '_blank');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(githubLink).toHaveAttribute(
        'data-analytics-param-platform',
        'github'
      );
    }
  );
});

describe('ProfilePageUI feature flags disabled behavior (#913)', () => {
  it('hides bookmark button, rating score, and TabsList while preserving experience, location, completed meetings, and intro sections', () => {
    render(
      <ProfilePageUI
        {...baseProps({
          userData: buildUserData({
            is_mentor: true,
            about: '資深產品設計經驗分享',
            years_of_experience: '5~10 年',
            location: '台灣',
            stats: {
              completed_meeting_count: 18,
              rating_count: 9,
              rating_average: 9.5,
            },
          }),
          isIdentityResolved: true,
          showBookmark: false,
          feedbackEnabled: false,
        })}
      />
    );

    expect(
      screen.queryByRole('button', { name: /收藏/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: '導師頁面分頁' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('評分')).not.toBeInTheDocument();
    expect(screen.getByText('資深產品設計經驗分享')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('台灣')).toBeInTheDocument();
  });
});

import { act, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingCalendarReader } from '@/lib/profile/bookingAvailability';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockClampSelectedDateToToday = vi.fn();
const mockReaderOnMonthChange = vi.fn();
let currentSearchParams = new URLSearchParams();

interface CapturedProfilePageUiProps {
  editorDialog?: React.ReactNode;
  schedule?: BookingCalendarReader;
  onReservation?: () => void;
}

interface CapturedMentorScheduleDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  reader?: BookingCalendarReader;
  onMonthChange?: BookingCalendarReader['onMonthChange'];
}

let latestProfilePageUiProps: CapturedProfilePageUiProps | null = null;
let latestMentorScheduleDialogProps: CapturedMentorScheduleDialogProps | null =
  null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
}));

// ProfilePageUI is loaded via next/dynamic; swap it for a shim that renders
// nothing but the injected editorDialog while capturing forwarded props for
// container wiring assertions.
vi.mock('next/dynamic', () => ({
  default: () => (props: CapturedProfilePageUiProps) => {
    latestProfilePageUiProps = props;
    return <div data-testid="profile-page-ui">{props.editorDialog}</div>;
  },
}));

vi.mock('@/components/profile/reservation/MentorScheduleDialog', () => ({
  default: (props: CapturedMentorScheduleDialogProps) => {
    latestMentorScheduleDialogProps = props;
    return (
      <div
        data-testid="mentor-schedule-dialog"
        data-open={props.open ? 'true' : 'false'}
      />
    );
  },
}));

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: (...args: unknown[]) => mockUseResolvedIdentity(...args),
}));

const mockUseUserData = vi.fn();
vi.mock('@/hooks/user/user-data/useUserData', () => ({
  default: (...args: unknown[]) => mockUseUserData(...args),
}));

const mockUseMentorFeedback = vi.fn();
vi.mock('@/hooks/user/feedback/useMentorFeedback', () => ({
  useMentorFeedback: (...args: unknown[]) => mockUseMentorFeedback(...args),
}));

vi.mock('@/hooks/useMentorSchedule', () => ({
  useMentorSchedule: () => ({
    loaded: true,
    reader: {
      year: 2026,
      month: 8,
      selectedDate: '2026-08-20',
      setSelectedDate: vi.fn(),
      selectedSlot: null,
      setSelectedSlot: vi.fn(),
      onMonthChange: mockReaderOnMonthChange,
      clampSelectedDateToToday: mockClampSelectedDateToToday,
      allowedDates: [],
      reload: vi.fn(),
    },
    editor: {},
  }),
}));

import { Toaster } from '@/components/ui/toaster';
import { clearToasts } from '@/components/ui/use-toast';
import { FAVORITE_SELF_BLOCKED_TOAST_MESSAGE } from '@/hooks/favorites';
import {
  favoriteMentorsReadModel,
  getPendingFavoriteMentorId,
  resetFavoriteMentorsReadModel,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import ProfilePageContainer from './container';

const PAGE_USER_ID = '123';
const emptyCatalogs: TagCatalogsByBucket = EMPTY_TAG_CATALOGS;
const initialDto = fromPartial<MentorProfileVO>({ user_id: 123 });

function renderContainer(catalogs: TagCatalogsByBucket | null = emptyCatalogs) {
  return render(
    <>
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={initialDto}
        initialCatalogs={catalogs}
      />
      <Toaster />
    </>
  );
}

function identity({
  sessionSettled,
  hasFullUser,
  userId,
}: {
  sessionSettled: boolean;
  hasFullUser: boolean;
  userId: string | null;
}) {
  let state: 'unknown' | 'hint-only' | 'confirmed-guest' | 'confirmed-member' =
    'confirmed-guest';
  if (!sessionSettled && !hasFullUser && userId) {
    state = 'hint-only';
  } else if (!sessionSettled && !hasFullUser && !userId) {
    state = 'unknown';
  } else if (sessionSettled && hasFullUser && userId) {
    state = 'confirmed-member';
  } else if (sessionSettled && !hasFullUser && !userId) {
    state = 'confirmed-guest';
  }

  return {
    state,
    userId: userId || undefined,
    avatar: undefined,
    isMentor: false,
  };
}

describe('ProfilePageContainer - owner-editor injection gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    clearToasts();
    resetFavoriteMentorsReadModel();
    currentSearchParams = new URLSearchParams();
    latestProfilePageUiProps = null;
    latestMentorScheduleDialogProps = null;
    mockUseUserData.mockReturnValue({
      userData: {
        user_id: 123,
        name: 'Test Mentor',
        avatar: '',
        job_title: 'Senior PM',
        company: 'XChange',
        is_mentor: true,
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: [],
        have_topic: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('forwards pageUserIdNumber, language, initialDto, and initialCatalogs directly into useUserData (#877)', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({ sessionSettled: true, hasFullUser: false, userId: null })
    );
    const seededCatalogs: TagCatalogsByBucket = {
      ...EMPTY_TAG_CATALOGS,
      industry: [{ subject_group: 'SOFTWARE', subject: '軟體及網路相關業' }],
    };

    const { unmount } = renderContainer(seededCatalogs);

    expect(mockUseUserData).toHaveBeenCalledWith(
      123,
      'zh_TW',
      initialDto,
      seededCatalogs,
      { expectedIsMentor: false }
    );
    unmount();

    renderContainer(null);
    expect(mockUseUserData).toHaveBeenLastCalledWith(
      123,
      'zh_TW',
      initialDto,
      undefined,
      { expectedIsMentor: false }
    );
  });

  it('withholds MentorScheduleDialog while the session has not settled, even for the profile owner', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: false,
        hasFullUser: false,
        userId: PAGE_USER_ID,
      })
    );

    renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('withholds MentorScheduleDialog from a settled visitor viewing someone else profile', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({ sessionSettled: true, hasFullUser: true, userId: '999' })
    );

    renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('withholds MentorScheduleDialog from a settled guest with no session user', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({ sessionSettled: true, hasFullUser: false, userId: null })
    );

    renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('withholds MentorScheduleDialog from a confirmed owner while userData is still loading', () => {
    mockUseUserData.mockReturnValue({
      userData: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );

    renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('injects MentorScheduleDialog once the session has settled on the owner and userData has loaded', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );

    renderContainer();

    expect(screen.getByTestId('mentor-schedule-dialog')).toBeInTheDocument();
  });

  it('covers a hinted member who settles to guest and asserts no owner control was ever rendered', () => {
    mockUseResolvedIdentity.mockReturnValueOnce(
      identity({
        sessionSettled: false,
        hasFullUser: false,
        userId: PAGE_USER_ID,
      })
    );

    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: false,
        userId: null,
      })
    );

    const { rerender } = renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();

    rerender(
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={initialDto}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('auto-opens MentorScheduleDialog and cleans URL for confirmed mentor owner with ?open-schedule=true (#709)', () => {
    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );

    const { unmount } = renderContainer();
    expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(mockReplace).not.toHaveBeenCalled();
    unmount();

    currentSearchParams = new URLSearchParams('open-schedule=true');
    renderContainer();

    expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(mockClampSelectedDateToToday).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(`/profile/${PAGE_USER_ID}`, {
      scroll: false,
    });
  });

  it('blocks ?open-schedule=true for non-owner, guest, unsettled, or non-mentor (#709)', () => {
    currentSearchParams = new URLSearchParams('open-schedule=true');

    for (const [settled, full, uid] of [
      [true, true, '999'],
      [true, false, null],
      [false, false, PAGE_USER_ID],
    ] as const) {
      mockUseResolvedIdentity.mockReturnValue(
        identity({ sessionSettled: settled, hasFullUser: full, userId: uid })
      );
      const { unmount } = renderContainer();
      expect(
        screen.queryByTestId('mentor-schedule-dialog')
      ).not.toBeInTheDocument();
      unmount();
    }

    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Mentee', is_mentor: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );
    renderContainer();

    expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(mockClampSelectedDateToToday).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('enables useMentorFeedback only for resolved mentor profiles (#736)', () => {
    mockUseMentorFeedback.mockClear();
    mockUseResolvedIdentity.mockReturnValue(
      identity({ sessionSettled: true, hasFullUser: false, userId: null })
    );

    mockUseUserData.mockReturnValue({
      userData: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const loadingEmptyRender = renderContainer();
    expect(mockUseMentorFeedback).toHaveBeenLastCalledWith({
      mentorId: 123,
      enabled: false,
    });
    loadingEmptyRender.unmount();

    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Cached Mentor', is_mentor: true },
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const loadingCachedMentorRender = renderContainer();
    expect(mockUseMentorFeedback).toHaveBeenLastCalledWith({
      mentorId: 123,
      enabled: false,
    });
    loadingCachedMentorRender.unmount();

    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Mentee', is_mentor: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const menteeRender = renderContainer();
    expect(mockUseMentorFeedback).toHaveBeenLastCalledWith({
      mentorId: 123,
      enabled: false,
    });
    menteeRender.unmount();

    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Mentor', is_mentor: true },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const mentorRender = renderContainer();
    expect(mockUseMentorFeedback).toHaveBeenLastCalledWith({
      mentorId: 123,
      enabled: true,
    });
    mentorRender.unmount();
  });

  it('consumes pendingFavoriteMentor for owner by showing "無法收藏自己" toast without calling favorite API (#756)', async () => {
    resetFavoriteMentorsReadModel();
    const addFavoriteMock = vi.fn().mockResolvedValue(undefined);
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
      addFavoriteMentor: addFavoriteMock,
      removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
    });
    savePendingFavoriteMentor(123);

    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );

    renderContainer();

    expect(
      await screen.findByText(FAVORITE_SELF_BLOCKED_TOAST_MESSAGE)
    ).toBeVisible();
    expect(addFavoriteMock).not.toHaveBeenCalled();
    expect(getPendingFavoriteMentorId()).toBeNull();
  });

  it('consumes pendingFavoriteMentor for non-owner member and automatically completes favorite (#756)', async () => {
    resetFavoriteMentorsReadModel();
    const addFavoriteMock = vi.fn().mockResolvedValue(undefined);
    favoriteMentorsReadModel.setTransport({
      fetchFavoriteMentors: vi.fn().mockResolvedValue([]),
      addFavoriteMentor: addFavoriteMock,
      removeFavoriteMentor: vi.fn().mockResolvedValue(undefined),
    });
    savePendingFavoriteMentor(123);

    mockUseResolvedIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: '999',
      })
    );

    renderContainer();

    await vi.waitFor(() => {
      expect(addFavoriteMock).toHaveBeenCalledWith(
        '999',
        123,
        expect.any(AbortSignal)
      );
    });
    await vi.waitFor(() => {
      expect(
        favoriteMentorsReadModel.getMentorState('999', 123).isFavorited
      ).toBe(true);
    });
    expect(getPendingFavoriteMentorId()).toBeNull();
    expect(
      screen.queryByText(FAVORITE_SELF_BLOCKED_TOAST_MESSAGE)
    ).not.toBeInTheDocument();
  });

  it('delegates the stale Mentee DTO guard to ProfileReadModel via expectedIsMentor ONLY when confirmed owner session is already Mentor, with no container-level refetch loop (#974 / #981)', () => {
    const refetchMock = vi.fn();
    const staleMenteeInitialDto = fromPartial<MentorProfileVO>({
      user_id: 123,
      is_mentor: false,
    });
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: PAGE_USER_ID,
      isMentor: true,
      avatar: undefined,
    });
    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Stale Mentee', is_mentor: false },
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });

    const { rerender } = render(
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={staleMenteeInitialDto}
        initialCatalogs={emptyCatalogs}
      />
    );

    expect(mockUseUserData).toHaveBeenCalledWith(
      123,
      'zh_TW',
      staleMenteeInitialDto,
      emptyCatalogs,
      { expectedIsMentor: true }
    );
    expect(refetchMock).not.toHaveBeenCalled();

    rerender(
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={staleMenteeInitialDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(refetchMock).not.toHaveBeenCalled();

    // Non-owner Mentor viewing a Mentee profile preserves initialDto without refetch
    vi.clearAllMocks();
    const nonOwnerRefetch = vi.fn();
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '999',
      isMentor: true,
      avatar: undefined,
    });
    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Mentee', is_mentor: false },
      isLoading: false,
      error: null,
      refetch: nonOwnerRefetch,
    });
    render(
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={staleMenteeInitialDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(mockUseUserData).toHaveBeenCalledWith(
      123,
      'zh_TW',
      staleMenteeInitialDto,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
    expect(nonOwnerRefetch).not.toHaveBeenCalled();

    // Mentee owner viewing own Mentee profile preserves initialDto without refetch
    vi.clearAllMocks();
    const menteeOwnerRefetch = vi.fn();
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: PAGE_USER_ID,
      isMentor: false,
      avatar: undefined,
    });
    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Mentee', is_mentor: false },
      isLoading: false,
      error: null,
      refetch: menteeOwnerRefetch,
    });
    render(
      <ProfilePageContainer
        pageUserId={PAGE_USER_ID}
        initialDto={staleMenteeInitialDto}
        initialCatalogs={emptyCatalogs}
      />
    );
    expect(mockUseUserData).toHaveBeenCalledWith(
      123,
      'zh_TW',
      staleMenteeInitialDto,
      emptyCatalogs,
      { expectedIsMentor: false }
    );
    expect(menteeOwnerRefetch).not.toHaveBeenCalled();
  });

  describe('scheduleReader.onMonthChange forwarding (#945)', () => {
    const nextMonth = new Date(2026, 8, 1);

    it('forwards { preserveSelectedDate: false } when MentorScheduleDialog is closed', () => {
      mockUseResolvedIdentity.mockReturnValue(
        identity({
          sessionSettled: true,
          hasFullUser: true,
          userId: PAGE_USER_ID,
        })
      );

      renderContainer();

      expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
        'data-open',
        'false'
      );

      latestProfilePageUiProps?.schedule?.onMonthChange?.(nextMonth);
      expect(mockReaderOnMonthChange).toHaveBeenCalledTimes(1);
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: false,
      });
    });

    it('forwards { preserveSelectedDate: true } when MentorScheduleDialog is open', () => {
      mockUseResolvedIdentity.mockReturnValue(
        identity({
          sessionSettled: true,
          hasFullUser: true,
          userId: PAGE_USER_ID,
        })
      );

      renderContainer();

      act(() => {
        latestProfilePageUiProps?.onReservation?.();
      });

      expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
        'data-open',
        'true'
      );

      latestProfilePageUiProps?.schedule?.onMonthChange?.(nextMonth);
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: true,
      });

      mockReaderOnMonthChange.mockClear();
      latestMentorScheduleDialogProps?.onMonthChange?.(nextMonth);
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: true,
      });
    });

    it('respects explicit options overrides regardless of whether MentorScheduleDialog is closed or open', () => {
      mockUseResolvedIdentity.mockReturnValue(
        identity({
          sessionSettled: true,
          hasFullUser: true,
          userId: PAGE_USER_ID,
        })
      );

      renderContainer();

      // Explicit { preserveSelectedDate: true } while dialog is closed
      latestProfilePageUiProps?.schedule?.onMonthChange?.(nextMonth, {
        preserveSelectedDate: true,
      });
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: true,
      });

      // Open dialog, then pass explicit { preserveSelectedDate: false }
      act(() => {
        latestProfilePageUiProps?.onReservation?.();
      });
      expect(screen.getByTestId('mentor-schedule-dialog')).toHaveAttribute(
        'data-open',
        'true'
      );

      latestProfilePageUiProps?.schedule?.onMonthChange?.(nextMonth, {
        preserveSelectedDate: false,
      });
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: false,
      });

      latestMentorScheduleDialogProps?.onMonthChange?.(nextMonth, {
        preserveSelectedDate: false,
      });
      expect(mockReaderOnMonthChange).toHaveBeenLastCalledWith(nextMonth, {
        preserveSelectedDate: false,
      });
    });
  });
});

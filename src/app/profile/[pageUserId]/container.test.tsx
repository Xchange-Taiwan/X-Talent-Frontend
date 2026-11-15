import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockClampSelectedDateToToday = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
}));

// ProfilePageUI is loaded via next/dynamic; swap it for a shim that renders
// nothing but the injected editorDialog, so these tests assert exactly one
// thing: whether the container decided to hand the editor down at all.
vi.mock('next/dynamic', () => ({
  default: () => (props: { editorDialog?: React.ReactNode }) => (
    <div data-testid="profile-page-ui">{props.editorDialog}</div>
  ),
}));

vi.mock('@/components/profile/reservation/MentorScheduleDialog', () => ({
  default: ({ open }: { open?: boolean }) => (
    <div
      data-testid="mentor-schedule-dialog"
      data-open={open ? 'true' : 'false'}
    />
  ),
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
      onMonthChange: vi.fn(),
      clampSelectedDateToToday: mockClampSelectedDateToToday,
      allowedDates: [],
      reload: vi.fn(),
    },
    editor: {},
  }),
}));

vi.mock('@/hooks/user/reservation/useBookingConfirmation', () => ({
  useBookingConfirmation: () => ({
    isSubmitting: false,
    handleConfirmReservation: vi.fn(),
  }),
}));

import { Toaster } from '@/components/ui/toaster';
import { clearToasts } from '@/components/ui/use-toast';
import { FAVORITE_SELF_BLOCKED_TOAST_MESSAGE } from '@/hooks/favorites';
import {
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import {
  favoriteMentorStore,
  resetFavoriteMentorStore,
} from '@/stores/favoriteMentorStore';
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
    resetFavoriteMentorStore();
    currentSearchParams = new URLSearchParams();
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
      seededCatalogs
    );
    unmount();

    renderContainer(null);
    expect(mockUseUserData).toHaveBeenLastCalledWith(
      123,
      'zh_TW',
      initialDto,
      undefined
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
    const addFavoriteMock = vi.fn().mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
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
    const addFavoriteMock = vi.fn().mockResolvedValue(undefined);
    favoriteMentorStore.setAdapter({
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
      expect(addFavoriteMock).toHaveBeenCalledWith(123);
    });
    expect(favoriteMentorStore.isFavorited(123)).toBe(true);
    expect(getPendingFavoriteMentorId()).toBeNull();
    expect(
      screen.queryByText(FAVORITE_SELF_BLOCKED_TOAST_MESSAGE)
    ).not.toBeInTheDocument();
  });
});

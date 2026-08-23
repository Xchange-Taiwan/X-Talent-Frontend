import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  default: () => <div data-testid="mentor-schedule-dialog" />,
}));

const mockUseIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useIdentity', () => ({
  useIdentity: (...args: unknown[]) => mockUseIdentity(...args),
}));

const mockUseUserData = vi.fn();
vi.mock('@/hooks/user/user-data/useUserData', () => ({
  default: (...args: unknown[]) => mockUseUserData(...args),
}));

vi.mock('@/hooks/user/user-data/useUserProfileDto', () => ({
  primeUserProfileDtoCacheIfEmpty: vi.fn(),
}));

vi.mock('@/hooks/user/tags/useTagCatalog', () => ({
  primeTagCatalogCacheIfEmpty: vi.fn(),
}));

vi.mock('@/hooks/useMentorSchedule', () => ({
  useMentorSchedule: () => ({
    loaded: true,
    selectedDate: '2026-08-20',
    setSelectedDate: vi.fn(),
    parsedDraft: [],
    allowedDates: [],
    reload: vi.fn(),
  }),
}));

vi.mock('@/hooks/user/reservation/useReservationDateClamp', () => ({
  useReservationDateClamp: () => ({
    handleScheduleMonthChange: vi.fn(),
    clampSelectedDateToToday: vi.fn(),
  }),
}));

vi.mock('@/hooks/user/reservation/useBookingConfirmation', () => ({
  useBookingConfirmation: () => ({
    isSubmitting: false,
    handleConfirmReservation: vi.fn(),
  }),
}));

import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import ProfilePageContainer from './container';

const PAGE_USER_ID = '123';
const emptyCatalogs = {} as TagCatalogsByBucket;
const initialDto = { user_id: 123 } as MentorProfileVO;

function renderContainer() {
  return render(
    <ProfilePageContainer
      pageUserId={PAGE_USER_ID}
      initialDto={initialDto}
      initialCatalogs={emptyCatalogs}
    />
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
  return { sessionSettled, hasFullUser, userId };
}

describe('ProfilePageContainer - owner-editor injection gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserData.mockReturnValue({
      userData: { user_id: 123, name: 'Test Mentor', is_mentor: true },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('withholds MentorScheduleDialog while the session has not settled, even for the profile owner', () => {
    // The hint cookie can name the right user before useSession() confirms
    // it; injecting the editor here is exactly the role flash the container
    // gate exists to prevent.
    mockUseIdentity.mockReturnValue(
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
    mockUseIdentity.mockReturnValue(
      identity({ sessionSettled: true, hasFullUser: true, userId: '999' })
    );

    renderContainer();

    expect(
      screen.queryByTestId('mentor-schedule-dialog')
    ).not.toBeInTheDocument();
  });

  it('withholds MentorScheduleDialog from a settled guest with no session user', () => {
    mockUseIdentity.mockReturnValue(
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
    mockUseIdentity.mockReturnValue(
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
    mockUseIdentity.mockReturnValue(
      identity({
        sessionSettled: true,
        hasFullUser: true,
        userId: PAGE_USER_ID,
      })
    );

    renderContainer();

    expect(screen.getByTestId('mentor-schedule-dialog')).toBeInTheDocument();
  });
});

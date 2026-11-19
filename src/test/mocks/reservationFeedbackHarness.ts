import { fromPartial } from '@total-typescript/shoehorn';
import { vi } from 'vitest';

import { feedbackSessionCoordinator } from '@/lib/reservation/feedbackSessionCoordinator';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';
import type { Reservation } from '@/types/reservation';

let currentPathname: string | null = '/mentor-pool';
let currentQuery = '';

export const feedbackRouteMock = {
  replace: vi.fn<(url: string, opts?: { scroll?: boolean }) => void>(),
};

export function setMockFeedbackRoute(
  pathname: string | null,
  query = ''
): void {
  currentPathname = pathname;
  currentQuery = query.startsWith('?') ? query.slice(1) : query;
}

export function setMockFeedbackPathname(pathname: string | null): void {
  currentPathname = pathname;
}

export function setMockFeedbackQuery(query: string): void {
  currentQuery = query.startsWith('?') ? query.slice(1) : query;
}

export const feedbackNavigationMockFactory = () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentQuery),
  useRouter: () => ({
    replace: (url: string, opts?: { scroll?: boolean }) =>
      feedbackRouteMock.replace(url, opts),
  }),
});

export interface FeedbackSessionUserOverrides {
  id?: string;
  isMentor?: boolean;
  onBoarding?: boolean;
  error?: string;
}

export function setAuthenticatedFeedbackSession(
  overrides: FeedbackSessionUserOverrides = {}
): void {
  const id = 'id' in overrides ? overrides.id : '1';
  const isMentor = 'isMentor' in overrides ? overrides.isMentor : false;
  const onBoarding = 'onBoarding' in overrides ? overrides.onBoarding : true;
  const { error } = overrides;

  mockUseSession.mockReturnValue({
    data: {
      ...mockSession,
      ...(error !== undefined ? { error } : {}),
      user: {
        ...mockSession.user,
        id,
        isMentor,
        onBoarding,
      },
    },
    status: 'authenticated',
    update: vi.fn(),
  });
}

export function setUnauthenticatedFeedbackSession(): void {
  mockUseSession.mockReturnValue({
    data: null,
    status: 'unauthenticated',
    update: vi.fn(),
  });
}

export function setLoadingFeedbackSession(): void {
  mockUseSession.mockReturnValue({
    data: null,
    status: 'loading',
    update: vi.fn(),
  });
}

export function makeFeedbackTestReservation(
  id: string,
  overrides: Partial<Reservation> = {}
): Reservation {
  const dtstart = overrides.dtstart ?? 1760000000;
  const dtend = overrides.dtend ?? dtstart + 1800;
  const viewerRole = overrides.viewerRole;

  return fromPartial<Reservation>({
    id,
    name: `Partner ${id}`,
    date: '2026/10/12',
    time: '19:00–19:30',
    dtstart,
    dtend,
    senderUserId: viewerRole === 'MENTOR' ? 202 : 1,
    participantUserId: viewerRole === 'MENTOR' ? 1 : 303,
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
    ...overrides,
  });
}

export function resetFeedbackHookTestState(opts?: {
  pathname?: string | null;
  query?: string;
}): void {
  vi.clearAllMocks();
  if (typeof window !== 'undefined') {
    window.sessionStorage.clear();
  }
  feedbackSessionCoordinator.clearAllSessionState();
  setMockFeedbackRoute(opts?.pathname ?? '/mentor-pool', opts?.query ?? '');
}

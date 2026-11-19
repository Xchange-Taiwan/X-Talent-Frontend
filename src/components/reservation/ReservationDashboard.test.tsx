import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationList } from '@/components/reservation/ReservationList';
import {
  type ReservationTabSlice,
  useReservationDashboard,
  type UseReservationDashboardReturn,
} from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import type { Reservation } from '@/types/reservation';

import { ReservationDashboard } from './ReservationDashboard';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
const mockToString = vi.fn().mockReturnValue('');
const mockPathname = vi.fn().mockReturnValue('/reservation/mentor');

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
    toString: () => mockToString(),
  }),
  useRouter: () => ({
    replace: (url: string) => mockReplace(url),
  }),
  usePathname: () => mockPathname(),
}));

vi.mock('@/hooks/user/reservation/useReservationData', () => ({
  useReservationDashboard: vi.fn(),
}));

vi.mock('@/components/reservation/ReservationList', () => ({
  ReservationList: vi.fn(({ items, variant, sourceRole, onLoadMore }) => (
    <div data-testid={`reservation-list-${variant}-${sourceRole}`}>
      Mock List: {items.length} items
      <button data-testid={`load-more-${variant}`} onClick={onLoadMore}>
        Load More
      </button>
    </div>
  )),
}));

vi.mock('@/app/reservation/skeleton', () => ({
  ReservationListSkeleton: () => <div data-testid="reservation-skeleton" />,
}));

const TabsContext = React.createContext<{
  onValueChange?: (value: string) => void;
}>({});

vi.mock('@/components/ui/tabs', () => {
  return {
    Tabs: ({
      children,
      onValueChange,
      defaultValue,
      value,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
      defaultValue?: string;
      value?: string;
    }) => (
      <TabsContext.Provider value={{ onValueChange }}>
        <div data-testid="tabs" data-default-value={defaultValue || value}>
          {children}
        </div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tabs-list">{children}</div>
    ),
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const { onValueChange } = React.useContext(TabsContext);
      return (
        <button
          data-testid={`trigger-${value}`}
          onClick={() => onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => <div data-testid={`content-${value}`}>{children}</div>,
  };
});

function makeSlice(
  items: Partial<Reservation>[],
  overrides: Partial<ReservationTabSlice> = {}
): ReservationTabSlice {
  return {
    items: items as Reservation[],
    badgeCount: items.length,
    showBadge: true,
    isInitialLoading: false,
    isFetching: false,
    isLoadingMore: false,
    isLoaded: true,
    hasMore: false,
    loadMore: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ReservationDashboard', () => {
  const mockLoadMorePending = vi.fn().mockResolvedValue(undefined);
  const mockLoadMoreUpcoming = vi.fn().mockResolvedValue(undefined);
  const mockLoadMoreHistory = vi.fn().mockResolvedValue(undefined);
  const mockLoadHistory = vi.fn().mockResolvedValue(undefined);

  const buildDashboardState = (
    overrides: Partial<UseReservationDashboardReturn> = {}
  ): UseReservationDashboardReturn => ({
    activeTab: 'pending',
    myUserId: 'user-123',
    loadHistory: mockLoadHistory,
    tabs: {
      pending: makeSlice([{ id: '2', dtstart: 3000, dtend: 4000 }], {
        loadMore: mockLoadMorePending,
      }),
      upcoming: makeSlice([{ id: '1', dtstart: 1000, dtend: 2000 }], {
        loadMore: mockLoadMoreUpcoming,
      }),
      history: makeSlice([{ id: '3', dtstart: 5000, dtend: 6000 }], {
        loadMore: mockLoadMoreHistory,
      }),
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockToString.mockReturnValue('');
    mockPathname.mockReturnValue('/reservation/mentor');
  });

  it('renders Mentee dashboard using canonical Radix tab values ("pending" | "upcoming" | "history") without role suffixes (#939)', () => {
    vi.mocked(useReservationDashboard).mockReturnValue(buildDashboardState());

    render(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByText('預約導師')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'pending'
    );
    expect(screen.getByText(/即將到來/)).toBeInTheDocument();
    expect(screen.getByText(/等待回覆/)).toBeInTheDocument();
    expect(screen.getByText(/歷史紀錄/)).toBeInTheDocument();

    const triggers = Array.from(
      screen.getByTestId('tabs-list').querySelectorAll('button')
    ).map((btn) => btn.getAttribute('data-testid'));
    expect(triggers).toEqual([
      'trigger-pending',
      'trigger-upcoming',
      'trigger-history',
    ]);

    const upcomingList = screen.getByTestId('reservation-list-upcoming-mentee');
    expect(upcomingList).toHaveTextContent('Mock List: 1 items');
  });

  it('renders Mentor dashboard with "擔任導師" heading and "待您回覆" pending label', () => {
    vi.mocked(useReservationDashboard).mockReturnValue(buildDashboardState());

    render(<ReservationDashboard userRole="mentor" />);

    expect(screen.getByText('擔任導師')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'pending'
    );
    expect(screen.getByText(/待您回覆/)).toBeInTheDocument();

    const upcomingList = screen.getByTestId('reservation-list-upcoming-mentor');
    expect(upcomingList).toHaveTextContent('Mock List: 1 items');
  });

  it('renders Skeleton on Render 1 for ?tab=history when tabs.history.isInitialLoading is true (no empty-state flash, #939)', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'tab' ? 'history' : null
    );
    const state = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([], { isInitialLoading: true }),
        upcoming: makeSlice([], { isInitialLoading: true }),
        history: makeSlice([], {
          isInitialLoading: true,
          isFetching: true,
          isLoaded: false,
          showBadge: false,
        }),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'history'
    );
    const historyContent = screen.getByTestId('content-history');
    expect(
      historyContent.querySelector('[data-testid="reservation-skeleton"]')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('reservation-list-history-mentee')
    ).not.toBeInTheDocument();
  });

  it('triggers loadHistory when clicking History tab while not loaded and updates URL / analytics', () => {
    const state = buildDashboardState();
    state.tabs.history = makeSlice([], {
      isLoaded: false,
      isFetching: false,
      showBadge: false,
    });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);

    fireEvent.click(screen.getByTestId('trigger-history'));

    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('tab=history')
    );
    expect(trackEvent).toHaveBeenCalledWith({
      name: 'reservation_tab_changed',
      feature: 'reservation',
      metadata: { role: 'mentee', tab: 'history' },
    });
  });

  it('forwards per-tab loadMore callbacks directly from tabs slices', () => {
    vi.mocked(useReservationDashboard).mockReturnValue(buildDashboardState());

    render(<ReservationDashboard userRole="mentee" />);

    fireEvent.click(screen.getByTestId('load-more-upcoming'));
    expect(mockLoadMoreUpcoming).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('load-more-pending-mentee'));
    expect(mockLoadMorePending).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('load-more-history'));
    expect(mockLoadMoreHistory).toHaveBeenCalledTimes(1);
  });

  it('renders badgeCount and showBadge directly from hook-computed tab slices (#860 / #939)', () => {
    const state = buildDashboardState();
    state.tabs.upcoming = makeSlice([], { badgeCount: 3 });
    state.tabs.pending = makeSlice([], { badgeCount: 2 });
    state.tabs.history = makeSlice([], { badgeCount: 0, showBadge: false });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByTestId('trigger-upcoming')).toHaveTextContent(
      '即將到來3'
    );
    expect(screen.getByTestId('trigger-pending')).toHaveTextContent(
      '等待回覆2'
    );
    expect(screen.getByTestId('trigger-history')).toHaveTextContent(
      /^歷史紀錄$/
    );
  });

  it('clears stale feedback=queue query parameter once mentee history finishes loading with 0 pending feedback items', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) => {
      if (key === 'feedback') return 'queue';
      if (key === 'tab') return 'upcoming';
      return null;
    });
    mockToString.mockReturnValue('tab=upcoming&feedback=queue');

    const loadingState = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([]),
        upcoming: makeSlice([]),
        history: makeSlice([], {
          isInitialLoading: true,
          isFetching: true,
          isLoaded: false,
        }),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(loadingState);

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);
    expect(mockReplace).not.toHaveBeenCalled();

    const settledEmptyState = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([]),
        upcoming: makeSlice([]),
        history: makeSlice([], {
          isInitialLoading: false,
          isFetching: false,
          isLoaded: true,
        }),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(settledEmptyState);

    rerender(<ReservationDashboard userRole="mentee" />);
    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=upcoming'
    );
  });

  it('keeps feedback=queue while mentee history has pending ANSWER feedback items', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) =>
      key === 'feedback' ? 'queue' : null
    );
    mockToString.mockReturnValue('feedback=queue');

    const state = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([]),
        upcoming: makeSlice([]),
        history: makeSlice([
          {
            id: 'hist-pending-answer',
            dtstart: 5000,
            dtend: 6000,
            feedback: {
              meetingHappened: null,
              rating: null,
              nextStep: 'ANSWER',
            },
          },
        ]),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);
    expect(mockReplace).not.toHaveBeenCalled();
    const historyCall = vi
      .mocked(ReservationList)
      .mock.calls.find(([props]) => props.variant === 'history');
    expect(historyCall?.[0].feedbackQueueItems).toEqual([
      expect.objectContaining({ id: 'hist-pending-answer' }),
    ]);
  });

  it('activates History tab, suppresses queue, and forwards deepLinkDialogReservation when reservationId deep link is present (#733)', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) => {
      if (key === 'tab') return 'history';
      if (key === 'feedback') return 'queue';
      if (key === 'reservationId') return '101';
      return null;
    });
    mockToString.mockReturnValue(
      'tab=history&feedback=queue&reservationId=101'
    );

    const state = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([]),
        upcoming: makeSlice([]),
        history: makeSlice([
          {
            id: '101',
            dtstart: 5000,
            dtend: 6000,
            feedback: {
              meetingHappened: null,
              rating: null,
              nextStep: 'ANSWER',
            },
          },
          {
            id: '102',
            dtstart: 7000,
            dtend: 8000,
            feedback: {
              meetingHappened: null,
              rating: null,
              nextStep: 'ANSWER',
            },
          },
        ]),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);
    const historyCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const latestHistoryCall = historyCalls[historyCalls.length - 1];
    expect(latestHistoryCall?.[0].feedbackQueueItems).toBeNull();
    expect(latestHistoryCall?.[0].deepLinkDialogReservation).toEqual(
      expect.objectContaining({ id: '101' })
    );
  });

  it('clears highlightedReservationId and autoExpandedReservationId when switching away from the history tab (#733)', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) => {
      if (key === 'tab') return 'history';
      if (key === 'reservationId') return '102';
      return null;
    });
    mockToString.mockReturnValue('tab=history&reservationId=102');

    const state = buildDashboardState({
      activeTab: 'history',
      tabs: {
        pending: makeSlice([]),
        upcoming: makeSlice([]),
        history: makeSlice([
          {
            id: '102',
            dtstart: 5000,
            dtend: 6000,
            feedback: {
              meetingHappened: true,
              rating: {
                rating: 10,
                content: '既有回饋',
                createdAt: 1760000000,
                updatedAt: 1760000000,
                authorName: 'T***',
                isPublic: true,
              },
              nextStep: null,
            },
          },
        ]),
      },
    });
    vi.mocked(useReservationDashboard).mockReturnValue(state);

    render(<ReservationDashboard userRole="mentee" />);

    const initialHistoryCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const initialHistoryProps =
      initialHistoryCalls[initialHistoryCalls.length - 1]?.[0];
    expect(initialHistoryProps?.highlightedReservationId).toBe('102');
    expect(initialHistoryProps?.autoExpandedReservationId).toBe('102');

    mockGet.mockImplementation((key: string) =>
      key === 'tab' ? 'history' : null
    );
    mockToString.mockReturnValue('tab=history');

    fireEvent.click(screen.getByTestId('trigger-upcoming'));

    const afterSwitchHistoryCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const afterSwitchHistoryProps =
      afterSwitchHistoryCalls[afterSwitchHistoryCalls.length - 1]?.[0];
    expect(afterSwitchHistoryProps?.highlightedReservationId).toBeNull();
    expect(afterSwitchHistoryProps?.autoExpandedReservationId).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationData } from '@/hooks/user/reservation/useReservationData';

import { ReservationDashboard } from './ReservationDashboard';

// Mock next/navigation
const mockReplace = vi.fn();
const mockGet = vi.fn().mockReturnValue(null);
const mockFetchReservationFeedback = vi.fn().mockResolvedValue(null);
const mockFetchAllReservationsForState = vi.fn().mockResolvedValue([]);

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
    toString: () => '',
  }),
  useRouter: () => ({
    replace: (url: string) => mockReplace(url),
  }),
  usePathname: () => '/reservation/mentor',
}));

vi.mock('@/services/reservations', () => ({
  fetchAllReservationsForState: (...args: unknown[]) =>
    mockFetchAllReservationsForState(...args),
  fetchReservationFeedback: (...args: unknown[]) =>
    mockFetchReservationFeedback(...args),
}));

// Mock the hook
vi.mock('@/hooks/user/reservation/useReservationData', () => ({
  useReservationData: vi.fn(),
}));

// Mock ReservationList to isolate the dashboard test
vi.mock('@/components/reservation/ReservationList', () => ({
  ReservationList: vi.fn(
    ({
      items,
      variant,
      sourceRole,
      onLoadMore,
      targetReservationId,
      autoOpenReservationId,
    }) => (
      <div
        data-testid={`reservation-list-${variant}-${sourceRole}`}
        data-target-id={targetReservationId ?? ''}
        data-auto-open-id={autoOpenReservationId ?? ''}
      >
        Mock List: {items.length} items
        <button data-testid={`load-more-${variant}`} onClick={onLoadMore}>
          Load More
        </button>
      </div>
    )
  ),
}));

// Mock the Skeleton to make it easily assertable
vi.mock('@/app/reservation/skeleton', () => ({
  ReservationListSkeleton: () => <div data-testid="reservation-skeleton" />,
}));

// Mock @/components/ui/tabs to bypass Radix UI primitive JSDOM event issues
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

describe('ReservationDashboard', () => {
  const mockLoadMore = vi.fn();
  const mockLoadHistory = vi.fn();
  const mockOnMutationSuccess = vi.fn();

  const baseHookReturnValue = {
    data: {
      upcoming: [{ id: '1', dtstart: 1000, dtend: 2000, status: 'upcoming' }],
      pending: [{ id: '2', dtstart: 3000, dtend: 4000, status: 'pending' }],
      history: [{ id: '3', dtstart: 5000, dtend: 6000, status: 'history' }],
      nextTokens: { upcoming: 0, pending: 0, history: 0 },
    },
    initialState: {
      upcoming: 'ready' as const,
      pending: 'ready' as const,
      history: 'ready' as const,
    },
    loadingMoreStates: {
      upcoming: false,
      pending: false,
      history: false,
    },
    isLoading: false,
    isLoadingHistory: false,
    isHistoryLoaded: true,
    myUserId: 'user-123',
    loadMore: mockLoadMore,
    loadHistory: mockLoadHistory,
    onMutationSuccess: mockOnMutationSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockFetchReservationFeedback.mockResolvedValue(null);
    mockFetchAllReservationsForState.mockResolvedValue([]);
  });

  it('renders correctly for role "mentee"', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );

    render(<ReservationDashboard userRole="mentee" />);

    // Check heading
    expect(screen.getByText('預約導師')).toBeInTheDocument();

    // Pending tab is selected by default when URL has no ?tab= param
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'pending-mentee'
    );

    // Check tabs are rendered with correct counts
    expect(screen.getByText(/即將到來/)).toBeInTheDocument();
    expect(screen.getByText(/等待回覆/)).toBeInTheDocument();
    expect(screen.getByText(/歷史紀錄/)).toBeInTheDocument();

    // Check correct count badges
    const badgeElements = screen.getAllByText('1');
    expect(badgeElements.length).toBeGreaterThanOrEqual(2);

    // Check upcoming list is rendered for mentee
    const upcomingList = screen.getByTestId('reservation-list-upcoming-mentee');
    expect(upcomingList).toBeInTheDocument();
    expect(upcomingList).toHaveTextContent('Mock List: 1 items');
  });

  it('renders correctly for role "mentor"', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );

    render(<ReservationDashboard userRole="mentor" />);

    // Check heading
    expect(screen.getByText('擔任導師')).toBeInTheDocument();

    // Pending tab is selected by default when URL has no ?tab= param
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'pending-mentor'
    );

    // Check tabs are rendered with correct counts
    expect(screen.getByText(/即將到來/)).toBeInTheDocument();
    expect(screen.getByText(/待您回覆/)).toBeInTheDocument(); // Mentor specific label
    expect(screen.getByText(/歷史紀錄/)).toBeInTheDocument();

    // Check upcoming list is rendered for mentor
    const upcomingList = screen.getByTestId('reservation-list-upcoming-mentor');
    expect(upcomingList).toBeInTheDocument();
    expect(upcomingList).toHaveTextContent('Mock List: 1 items');
  });

  it('shows loading skeletons when lists are in loading state', () => {
    const loadingHookReturnValue = {
      ...baseHookReturnValue,
      initialState: {
        upcoming: 'loading' as const,
        pending: 'loading' as const,
        history: 'idle' as const,
      },
      isHistoryLoaded: false,
    };
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(loadingHookReturnValue)
    );

    render(<ReservationDashboard userRole="mentee" />);

    // The active tab is pending by default, so it should render the skeleton
    expect(
      screen.getAllByTestId('reservation-skeleton')[0]
    ).toBeInTheDocument();
  });

  it('triggers loadHistory when clicking the history tab if history is not loaded', () => {
    const notLoadedHistoryReturnValue = {
      ...baseHookReturnValue,
      isHistoryLoaded: false,
      isLoadingHistory: false,
    };
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(notLoadedHistoryReturnValue)
    );

    render(<ReservationDashboard userRole="mentee" />);

    // Find the history tab trigger and click it
    const historyTrigger = screen.getByTestId('trigger-history');
    fireEvent.click(historyTrigger);

    // Should call loadHistory
    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });

  it('correctly maps and triggers onLoadMore params for role "mentee"', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );

    render(<ReservationDashboard userRole="mentee" />);

    // --- Tab 1: Upcoming ---
    const upcomingLoadMore = screen.getByTestId('load-more-upcoming');
    fireEvent.click(upcomingLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('upcoming');

    // --- Tab 2: Pending ---
    const pendingTrigger = screen.getByTestId('trigger-pending-mentee');
    fireEvent.click(pendingTrigger);
    const pendingLoadMore = screen.getByTestId('load-more-pending-mentee');
    fireEvent.click(pendingLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('pending');

    // --- Tab 3: History ---
    const historyTrigger = screen.getByTestId('trigger-history');
    fireEvent.click(historyTrigger);
    const historyLoadMore = screen.getByTestId('load-more-history');
    fireEvent.click(historyLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('history');
  });

  it('correctly maps and triggers onLoadMore params for role "mentor"', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );

    render(<ReservationDashboard userRole="mentor" />);

    // --- Tab 1: Upcoming ---
    const upcomingLoadMore = screen.getByTestId('load-more-upcoming');
    fireEvent.click(upcomingLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('upcoming');

    // --- Tab 2: Pending ---
    const pendingTrigger = screen.getByTestId('trigger-pending-mentor');
    fireEvent.click(pendingTrigger);
    const pendingLoadMore = screen.getByTestId('load-more-pending-mentor');
    fireEvent.click(pendingLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('pending');

    // --- Tab 3: History ---
    const historyTrigger = screen.getByTestId('trigger-history');
    fireEvent.click(historyTrigger);
    const historyLoadMore = screen.getByTestId('load-more-history');
    fireEvent.click(historyLoadMore);
    expect(mockLoadMore).toHaveBeenCalledWith('history');
  });

  it('initializes the active tab based on "tab" search parameter and triggers loadHistory if history is selected and not loaded', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: false,
      })
    );

    // Test with tab=upcoming
    mockGet.mockReturnValue('upcoming');
    const { rerender } = render(<ReservationDashboard userRole="mentor" />);
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'upcoming-mentor'
    );

    // Test with tab=pending
    mockGet.mockReturnValue('pending');
    rerender(<ReservationDashboard userRole="mentor" />);
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'pending-mentor'
    );

    // Test with tab=history (which should also trigger loadHistory since isHistoryLoaded is false)
    mockGet.mockReturnValue('history');
    rerender(<ReservationDashboard userRole="mentor" />);
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'history'
    );
    expect(mockLoadHistory).toHaveBeenCalled();
  });

  it('updates the URL search parameter "tab" when switching tabs', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );
    mockGet.mockReturnValue('upcoming');

    render(<ReservationDashboard userRole="mentor" />);

    // Switch to Pending tab
    const pendingTrigger = screen.getByTestId('trigger-pending-mentor');
    fireEvent.click(pendingTrigger);

    // It should replace the URL with tab=pending
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('tab=pending')
    );
  });

  it('preserves existing badge counts for upcoming and pending tabs while history is loading (#860)', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: false,
        isLoadingHistory: false,
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByTestId('trigger-upcoming-mentee')).toHaveTextContent(
      '即將到來1'
    );
    expect(screen.getByTestId('trigger-pending-mentee')).toHaveTextContent(
      '等待回覆1'
    );

    // Simulate transient empty data while history is loading after clicking History tab
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: null,
        isHistoryLoaded: false,
        isLoadingHistory: true,
      })
    );

    rerender(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByTestId('trigger-upcoming-mentee')).toHaveTextContent(
      '即將到來1'
    );
    expect(screen.getByTestId('trigger-pending-mentee')).toHaveTextContent(
      '等待回覆1'
    );
  });

  it('places Pending tab before Upcoming tab for both mentee and mentor views (#730 1.h)', () => {
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial(baseHookReturnValue)
    );

    const { unmount } = render(<ReservationDashboard userRole="mentee" />);
    const menteeTabsList = screen.getByTestId('tabs-list');
    const menteeTriggers = Array.from(
      menteeTabsList.querySelectorAll('button')
    );
    expect(
      menteeTriggers.map((btn) => btn.getAttribute('data-testid'))
    ).toEqual([
      'trigger-pending-mentee',
      'trigger-upcoming-mentee',
      'trigger-history',
    ]);
    unmount();

    render(<ReservationDashboard userRole="mentor" />);
    const mentorTabsList = screen.getByTestId('tabs-list');
    const mentorTriggers = Array.from(
      mentorTabsList.querySelectorAll('button')
    );
    expect(
      mentorTriggers.map((btn) => btn.getAttribute('data-testid'))
    ).toEqual([
      'trigger-pending-mentor',
      'trigger-upcoming-mentor',
      'trigger-history',
    ]);
  });

  it('automatically triggers loadHistory then loadMoreHistory across pages when reservation_id is not in page 1 until the target item is found (#733)', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'reservation_id' ? '202' : null
    );
    mockFetchReservationFeedback.mockResolvedValue({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentor',
    });

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: false,
        isLoadingHistory: false,
        data: {
          ...baseHookReturnValue.data,
          history: [],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentor" />);

    await waitFor(() => {
      expect(mockLoadHistory).toHaveBeenCalledTimes(1);
    });
    expect(mockLoadMore).not.toHaveBeenCalled();

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: true,
        data: {
          ...baseHookReturnValue.data,
          history: [{ id: '201', dtstart: 5000, dtend: 6000 }],
          nextTokens: { upcoming: 0, pending: 0, history: 5000 },
        },
      })
    );

    rerender(<ReservationDashboard userRole="mentor" />);

    await waitFor(() => {
      expect(mockLoadMore).toHaveBeenCalledWith('history');
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(1);

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: true,
        data: {
          ...baseHookReturnValue.data,
          history: [
            { id: '201', dtstart: 5000, dtend: 6000 },
            {
              id: '202',
              dtstart: 4000,
              dtend: 4900,
              feedback: {
                meetingHappened: null,
                rating: null,
                nextStep: 'ANSWER',
              },
            },
          ],
          nextTokens: { upcoming: 0, pending: 0, history: 3900 },
        },
      })
    );

    rerender(<ReservationDashboard userRole="mentor" />);

    await waitFor(() => {
      const historyList = screen.getByTestId('reservation-list-history-mentor');
      expect(historyList).toHaveAttribute('data-target-id', '202');
      expect(historyList).toHaveAttribute('data-auto-open-id', '202');
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('stops auto-paginating and marks history exhausted when nextTokens.history does not advance after loadMore (#733)', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'reservation_id' ? '999' : null
    );
    mockFetchReservationFeedback.mockResolvedValue(null);
    mockFetchAllReservationsForState.mockResolvedValue([]);

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: true,
        loadingMoreStates: { upcoming: false, pending: false, history: false },
        data: {
          ...baseHookReturnValue.data,
          history: [{ id: '101', dtstart: 5000, dtend: 6000 }],
          nextTokens: { upcoming: 0, pending: 0, history: 5000 },
        },
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);

    await waitFor(() => {
      expect(mockLoadMore).toHaveBeenCalledWith('history');
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('reservation-skeleton')).toBeInTheDocument();

    // Simulate in-flight loadMore
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: true,
        loadingMoreStates: { upcoming: false, pending: false, history: true },
        data: {
          ...baseHookReturnValue.data,
          history: [{ id: '101', dtstart: 5000, dtend: 6000 }],
          nextTokens: { upcoming: 0, pending: 0, history: 5000 },
        },
      })
    );
    rerender(<ReservationDashboard userRole="mentee" />);

    // Simulate loadMore completing with the exact same stuck cursor (5000)
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: true,
        loadingMoreStates: { upcoming: false, pending: false, history: false },
        data: {
          ...baseHookReturnValue.data,
          history: [{ id: '101', dtstart: 5000, dtend: 6000 }],
          nextTokens: { upcoming: 0, pending: 0, history: 5000 },
        },
      })
    );
    rerender(<ReservationDashboard userRole="mentee" />);

    await waitFor(() => {
      expect(mockFetchAllReservationsForState).toHaveBeenCalledTimes(1);
      expect(screen.getByText('預約導師')).toBeInTheDocument();
    });
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('caps automatic history pagination at 50 pages when target reservation is never found (#733)', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'reservation_id' ? '999' : null
    );
    mockFetchReservationFeedback.mockResolvedValue({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentee',
    });

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isHistoryLoaded: true,
        data: {
          ...baseHookReturnValue.data,
          history: [{ id: '101', dtstart: 5000, dtend: 6000 }],
          nextTokens: { upcoming: 0, pending: 0, history: 1001 },
        },
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);

    for (let cursor = 1002; cursor <= 1055; cursor += 1) {
      vi.mocked(useReservationData).mockReturnValue(
        fromPartial({
          ...baseHookReturnValue,
          isHistoryLoaded: true,
          data: {
            ...baseHookReturnValue.data,
            history: [{ id: '101', dtstart: 5000, dtend: 6000 }],
            nextTokens: { upcoming: 0, pending: 0, history: cursor },
          },
        })
      );
      rerender(<ReservationDashboard userRole="mentee" />);
    }

    await waitFor(() => {
      expect(mockLoadMore).toHaveBeenCalledTimes(50);
    });
  });

  it('renders skeleton instead of Mentee dashboard while resolving Mentor role for an external reservation_id link (#733)', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'reservation_id' ? '202' : null
    );
    mockFetchReservationFeedback.mockReturnValue(new Promise(() => {}));

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: false,
      })
    );

    render(<ReservationDashboard userRole="mentee" />);

    expect(screen.getByTestId('reservation-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('預約導師')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tabs')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reservation-list-history-mentee')
    ).not.toBeInTheDocument();
    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });

  it('does not retry loadHistory in an infinite loop and unblocks role resolution when initial history load fails (#733)', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'reservation_id' ? '202' : null
    );
    mockFetchReservationFeedback.mockResolvedValue(null);
    mockFetchAllReservationsForState.mockResolvedValue([]);

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: false,
        isLoadingHistory: false,
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);

    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('reservation-skeleton')).toBeInTheDocument();

    // Simulate loadHistory in-flight
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: false,
        isLoadingHistory: true,
      })
    );
    rerender(<ReservationDashboard userRole="mentee" />);

    // Simulate loadHistory failing (isLoadingHistory resets to false while isHistoryLoaded remains false)
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        isMentor: true,
        isHistoryLoaded: false,
        isLoadingHistory: false,
      })
    );
    rerender(<ReservationDashboard userRole="mentee" />);

    await waitFor(() => {
      expect(mockFetchAllReservationsForState).toHaveBeenCalledTimes(1);
      expect(screen.getByText('預約導師')).toBeInTheDocument();
    });
    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });
});

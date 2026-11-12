import { fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationList } from '@/components/reservation/ReservationList';
import { useReservationData } from '@/hooks/user/reservation/useReservationData';

import { ReservationDashboard } from './ReservationDashboard';

// Mock next/navigation
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

// Mock the hook
vi.mock('@/hooks/user/reservation/useReservationData', () => ({
  useReservationData: vi.fn(),
}));

// Mock ReservationList to isolate the dashboard test
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
    mockToString.mockReturnValue('');
    mockPathname.mockReturnValue('/reservation/mentor');
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

  it('clears stale feedback=queue query parameter once mentee history finishes loading with 0 pending feedback items', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) => {
      if (key === 'feedback') return 'queue';
      if (key === 'tab') return 'upcoming';
      return null;
    });
    mockToString.mockReturnValue('tab=upcoming&feedback=queue');

    // 1. While history is still loading, must NOT prematurely strip feedback=queue
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: false,
        isLoadingHistory: true,
      })
    );

    const { rerender } = render(<ReservationDashboard userRole="mentee" />);
    expect(mockReplace).not.toHaveBeenCalled();

    // 2. Once history is loaded with empty list (0 pending feedback items), strips feedback=queue
    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

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

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [
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
          ],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    render(<ReservationDashboard userRole="mentee" />);
    expect(mockReplace).not.toHaveBeenCalled();
    const historyCall = vi
      .mocked(ReservationList)
      .mock.calls.find(([props]) => props.variant === 'history');
    expect(historyCall?.[0].feedbackQueueItems).toEqual([
      expect.objectContaining({ id: 'hist-pending-answer' }),
    ]);
  });

  it('activates History tab and forwards deepLinkDialogReservation & highlightedReservationId when reservationId deep link is present (#733)', () => {
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key: string) => {
      if (key === 'reservationId') return '101';
      return null;
    });
    mockToString.mockReturnValue('reservationId=101');

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [
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
          ],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    render(<ReservationDashboard userRole="mentee" />);
    expect(screen.getByTestId('tabs')).toHaveAttribute(
      'data-default-value',
      'history'
    );
    const historyCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const latestHistoryCall = historyCalls[historyCalls.length - 1];
    expect(latestHistoryCall?.[0].deepLinkDialogReservation).toEqual(
      expect.objectContaining({ id: '101' })
    );
    expect(latestHistoryCall?.[0].highlightedReservationId).toBe('101');
  });

  it.each(['reservationId', 'reservation_id', 'feedbackReservationId'])(
    'triggers initial loadHistory on mount when deep link has %s without tab=history and resolves target once loaded (#733)',
    (paramKey) => {
      mockPathname.mockReturnValue('/reservation/mentee');
      mockGet.mockImplementation((key: string) => {
        if (key === paramKey) return '101';
        return null;
      });
      mockToString.mockReturnValue(`${paramKey}=101`);

      // 1. Initial mount before history is loaded: must switch to history tab AND call loadHistory()
      vi.mocked(useReservationData).mockReturnValue(
        fromPartial({
          ...baseHookReturnValue,
          data: {
            upcoming: [],
            pending: [],
            history: [],
            nextTokens: { upcoming: 0, pending: 0, history: 0 },
          },
          isHistoryLoaded: false,
          isLoadingHistory: false,
        })
      );

      const { rerender } = render(<ReservationDashboard userRole="mentee" />);
      expect(screen.getByTestId('tabs')).toHaveAttribute(
        'data-default-value',
        'history'
      );
      expect(mockLoadHistory).toHaveBeenCalledTimes(1);

      // 2. Once history finishes loading, deepLinkDialogReservation and highlightedReservationId resolve
      vi.mocked(useReservationData).mockReturnValue(
        fromPartial({
          ...baseHookReturnValue,
          data: {
            upcoming: [],
            pending: [],
            history: [
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
            ],
            nextTokens: { upcoming: 0, pending: 0, history: 0 },
          },
          isHistoryLoaded: true,
          isLoadingHistory: false,
        })
      );

      rerender(<ReservationDashboard userRole="mentee" />);
      const historyCalls = vi
        .mocked(ReservationList)
        .mock.calls.filter(([props]) => props.variant === 'history');
      const latestHistoryCall = historyCalls[historyCalls.length - 1];
      expect(latestHistoryCall?.[0].deepLinkDialogReservation).toEqual(
        expect.objectContaining({ id: '101' })
      );
      expect(latestHistoryCall?.[0].highlightedReservationId).toBe('101');
    }
  );

  it('suppresses feedbackQueueItems to null and prioritizes deepLinkDialogReservation when ?tab=history&feedback=queue&reservationId=101 coexist (#733)', () => {
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

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [
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
          ],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

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

    vi.mocked(useReservationData).mockReturnValue(
      fromPartial({
        ...baseHookReturnValue,
        data: {
          upcoming: [],
          pending: [],
          history: [
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
          ],
          nextTokens: { upcoming: 0, pending: 0, history: 0 },
        },
        isHistoryLoaded: true,
        isLoadingHistory: false,
      })
    );

    render(<ReservationDashboard userRole="mentee" />);

    const initialHistoryCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const initialHistoryProps =
      initialHistoryCalls[initialHistoryCalls.length - 1]?.[0];
    expect(initialHistoryProps?.highlightedReservationId).toBe('102');
    expect(initialHistoryProps?.autoExpandedReservationId).toBe('102');

    // Simulate URL having cleaned reservationId, then user switches to Upcoming tab
    mockGet.mockImplementation((key: string) =>
      key === 'tab' ? 'history' : null
    );
    mockToString.mockReturnValue('tab=history');

    fireEvent.click(screen.getByTestId('trigger-upcoming-mentee'));

    const afterSwitchHistoryCalls = vi
      .mocked(ReservationList)
      .mock.calls.filter(([props]) => props.variant === 'history');
    const afterSwitchHistoryProps =
      afterSwitchHistoryCalls[afterSwitchHistoryCalls.length - 1]?.[0];
    expect(afterSwitchHistoryProps?.highlightedReservationId).toBeNull();
    expect(afterSwitchHistoryProps?.autoExpandedReservationId).toBeNull();
  });
});

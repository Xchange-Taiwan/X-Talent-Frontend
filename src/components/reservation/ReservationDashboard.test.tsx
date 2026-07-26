import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useReservationData,
  type UseReservationDataReturn,
} from '@/hooks/user/reservation/useReservationData';

import { ReservationDashboard } from './ReservationDashboard';

// Mock the hook
vi.mock('@/hooks/user/reservation/useReservationData', () => ({
  useReservationData: vi.fn(),
}));

// Mock ReservationList to isolate the dashboard test
vi.mock('@/components/reservation/ReservationList', () => ({
  ReservationList: vi.fn(({ items, variant, sourceRole }) => (
    <div data-testid={`reservation-list-${variant}-${sourceRole}`}>
      Mock List: {items.length} items
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
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
      defaultValue?: string;
    }) => (
      <TabsContext.Provider value={{ onValueChange }}>
        <div data-testid="tabs" data-default-value={defaultValue}>
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
      upcoming: 'ready',
      pending: 'ready',
      history: 'ready',
    },
    loadingMoreStates: {
      MENTEE_UPCOMING: false,
      MENTEE_PENDING: false,
      MENTEE_HISTORY: false,
      MENTOR_UPCOMING: false,
      MENTOR_PENDING: false,
      MENTOR_HISTORY: false,
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
  });

  it('renders correctly for role "mentee"', () => {
    vi.mocked(useReservationData).mockReturnValue(
      baseHookReturnValue as unknown as UseReservationDataReturn
    );

    render(<ReservationDashboard role="mentee" />);

    // Check heading
    expect(screen.getByText('預約導師')).toBeInTheDocument();

    // Check tabs are rendered with correct counts
    expect(screen.getByText(/即將到來/)).toBeInTheDocument();
    expect(screen.getByText(/等待回復/)).toBeInTheDocument();
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
      baseHookReturnValue as unknown as UseReservationDataReturn
    );

    render(<ReservationDashboard role="mentor" />);

    // Check heading
    expect(screen.getByText('擔任導師')).toBeInTheDocument();

    // Check tabs are rendered with correct counts
    expect(screen.getByText(/即將到來/)).toBeInTheDocument();
    expect(screen.getByText(/待您回復/)).toBeInTheDocument(); // Mentor specific label
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
        upcoming: 'loading',
        pending: 'loading',
        history: 'idle',
      },
      isHistoryLoaded: false,
    };
    vi.mocked(useReservationData).mockReturnValue(
      loadingHookReturnValue as unknown as UseReservationDataReturn
    );

    render(<ReservationDashboard role="mentee" />);

    // The active tab is upcoming by default, so it should render the skeleton
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
      notLoadedHistoryReturnValue as unknown as UseReservationDataReturn
    );

    render(<ReservationDashboard role="mentee" />);

    // Find the history tab trigger and click it
    const historyTrigger = screen.getByTestId('trigger-history');
    fireEvent.click(historyTrigger);

    // Should call loadHistory
    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });
});

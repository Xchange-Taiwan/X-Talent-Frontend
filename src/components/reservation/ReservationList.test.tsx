import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateReservationStatus } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

import { ReservationList } from './ReservationList';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

// Mock dialogs to render a simple button for callback execution
vi.mock('@/components/reservation/AcceptReservationDialog', () => ({
  __esModule: true,
  default: ({
    onAccept,
    reservation,
    disabled,
  }: {
    onAccept: (payload: { id: string; message: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="accept-btn"
      disabled={disabled}
      onClick={() =>
        onAccept({ id: reservation.id, message: 'Accept Message' })
      }
    >
      Accept Button
    </button>
  ),
}));

vi.mock('@/components/reservation/RejectReservationDialog', () => ({
  __esModule: true,
  default: ({
    onReject,
    reservation,
    disabled,
  }: {
    onReject: (payload: { id: string; reason: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="reject-btn"
      disabled={disabled}
      onClick={() => onReject({ id: reservation.id, reason: 'Reject Reason' })}
    >
      Reject Button
    </button>
  ),
}));

vi.mock('@/components/reservation/CancelReservationDialog', () => ({
  __esModule: true,
  default: ({
    onConfirmCancel,
    reservation,
    disabled,
  }: {
    onConfirmCancel: (payload: { id: string; reason: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="cancel-btn"
      disabled={disabled}
      onClick={() =>
        onConfirmCancel({ id: reservation.id, reason: 'Cancel Reason' })
      }
    >
      Cancel Button
    </button>
  ),
}));

vi.mock('@/components/reservation/ReservationConversationDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="conversation-dialog" />,
}));

// Mock the API client
const { mockUpdateReservationStatus } = vi.hoisted(() => {
  return { mockUpdateReservationStatus: vi.fn().mockResolvedValue({}) };
});

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    updateReservationStatus: mockUpdateReservationStatus,
    acceptReservation: vi
      .fn()
      .mockImplementation(async ({ reservation, myUserId }) => {
        await mockUpdateReservationStatus({
          userId: myUserId,
          reservationId: reservation.id,
          body: {},
        });
      }),
    rejectOrCancelReservation: vi
      .fn()
      .mockImplementation(async ({ reservation, myUserId }) => {
        await mockUpdateReservationStatus({
          userId: myUserId,
          reservationId: reservation.id,
          body: {},
        });
      }),
  };
});

// Mock toast and other modules
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
    captureApiFailure: vi.fn(),
  };
});

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

// Mock ReservationCard for fully isolated testing
vi.mock('./ReservationCard', () => ({
  ReservationCard: ({
    headerAction,
    feedbackContent,
    actions,
    footer,
    item,
    profileHref,
    isHighlighted = false,
    cardRef,
  }: {
    headerAction?: React.ReactNode;
    feedbackContent?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    item: { id: string; name: string };
    profileHref?: string;
    isHighlighted?: boolean;
    cardRef?: React.Ref<HTMLDivElement>;
  }) => (
    <div
      ref={cardRef}
      data-testid={`reservation-card-${item.id}`}
      data-reservation-id={String(item.id)}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      data-profile-href={profileHref}
    >
      <div data-testid={`header-action-${item.id}`}>{headerAction}</div>
      {item.name}
      {feedbackContent}
      {footer}
      <div data-testid={`bottom-actions-${item.id}`}>{actions}</div>
    </div>
  ),
}));

const mockReservation = {
  id: 'res-abc',
  name: 'Test Partner',
  roleLine: 'Designer',
  date: 'Mon, Jan 01, 2024',
  time: '10:00 am – 11:00 am',
  messages: [],
  scheduleId: 101,
  dtstart: 1700000000,
  dtend: 1700003600,
  senderUserId: 'user-123',
  participantUserId: 'user-456',
  version: 0,
};

describe('ReservationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateReservationStatus when accepting in pending-mentor variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
      />
    );

    const acceptBtn = screen.getByTestId('accept-btn');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('calls updateReservationStatus when rejecting in pending-mentor variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
      />
    );

    const rejectBtn = screen.getByTestId('reject-btn');
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('calls updateReservationStatus when cancelling in pending-mentee variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentee"
        sourceRole="mentee"
        myUserId="user-123"
      />
    );

    const cancelBtn = screen.getByTestId('cancel-btn');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('calls updateReservationStatus when cancelling in upcoming variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="upcoming"
        sourceRole="mentor"
        myUserId="user-123"
      />
    );

    const cancelBtn = screen.getByTestId('cancel-btn');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('disables dialog buttons while the mutation request is in-flight to prevent double submission', async () => {
    let resolveMutation: (v: unknown) => void = () => {};
    const mutationPromise = new Promise<unknown>((resolve) => {
      resolveMutation = resolve;
    });
    mockUpdateReservationStatus.mockReturnValue(mutationPromise);

    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
      />
    );

    const acceptBtn = screen.getByTestId('accept-btn');
    const rejectBtn = screen.getByTestId('reject-btn');

    expect(acceptBtn).not.toBeDisabled();
    expect(rejectBtn).not.toBeDisabled();

    // Trigger accept mutation
    fireEvent.click(acceptBtn);

    // During the in-flight mutation, BOTH buttons should be disabled for this item!
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();

    // Resolve the mutation
    await act(async () => {
      resolveMutation({});
    });

    await waitFor(() => {
      expect(acceptBtn).not.toBeDisabled();
      expect(rejectBtn).not.toBeDisabled();
    });
  });

  // Counterparty resolution, the self-guard, and profile-link invalidation
  // conditions are all owned and tested by resolveReservationViewer
  // (src/lib/reservation/reservationViewerModel.test.ts) - this is a single
  // thin rendering-level check that ReservationList actually forwards
  // whatever the model resolves.
  it('forwards the resolved profileHref from resolveReservationViewer to the card', () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="upcoming"
        sourceRole="mentee"
        myUserId="user-123" // matches senderUserId
      />
    );

    const card = screen.getByTestId('reservation-card-res-abc');
    expect(card).toHaveAttribute('data-profile-href', '/profile/user-456');
  });

  describe('Empty State guidance & CTA (#806)', () => {
    it.each([
      [
        'upcoming' as const,
        '目前還沒有即將到來的預約，立即前往導師池尋找適合的導師吧！',
      ],
      [
        'pending-mentee' as const,
        '目前還沒有等待回覆的預約，前往導師池探索並向導師提出預約申請吧！',
      ],
      [
        'history' as const,
        '目前還沒有歷史預約紀錄，前往導師池展開你的第一場職涯交流吧！',
      ],
    ])(
      'renders contextual mentee empty state and "前往尋找導師" CTA link to /mentor-pool for %s tab',
      (variant, expectedCopy) => {
        render(
          <ReservationList
            items={[]}
            variant={variant}
            sourceRole="mentee"
            myUserId="user-123"
          />
        );

        expect(screen.getByText('目前尚無資料')).toBeInTheDocument();
        expect(screen.getByText(expectedCopy)).toBeInTheDocument();

        const ctaLink = screen.getByRole('link', { name: '前往尋找導師' });
        expect(ctaLink).toHaveAttribute('href', '/mentor-pool');
      }
    );

    it.each([
      [
        'upcoming' as const,
        '目前還沒有即將到來的預約，前往個人頁面確認或新增可預約時段，讓學員更容易找到你！',
      ],
      [
        'pending-mentor' as const,
        '目前還沒有待您回覆的預約申請，前往個人頁面管理可預約時段以提升預約率！',
      ],
      [
        'history' as const,
        '目前還沒有歷史預約紀錄，前往個人頁面設定可預約時段，開始你的導師交流之旅吧！',
      ],
    ])(
      'renders contextual mentor empty state and "管理可預約時段" CTA link to /profile/:id for %s tab',
      (variant, expectedCopy) => {
        render(
          <ReservationList
            items={[]}
            variant={variant}
            sourceRole="mentor"
            myUserId="mentor-789"
          />
        );

        expect(screen.getByText('目前尚無資料')).toBeInTheDocument();
        expect(screen.getByText(expectedCopy)).toBeInTheDocument();

        const ctaLink = screen.getByRole('link', { name: '管理可預約時段' });
        expect(ctaLink).toHaveAttribute('href', '/profile/mentor-789');
      }
    );

    it('omits the mentor profile CTA link when myUserId is undefined', () => {
      render(
        <ReservationList
          items={[]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId={undefined}
        />
      );

      expect(screen.getByText('目前尚無資料')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: '管理可預約時段' })
      ).not.toBeInTheDocument();
    });
  });

  describe('history feedback card states & collapsible toggles (#730 / #734 / #731)', () => {
    it('renders 填寫回饋 button in top-right only when nextStep === "ANSWER" and falls back to 已結束 when feedback is absent', () => {
      const answerItem: Reservation = {
        ...mockReservation,
        id: 'hist-answer',
        senderUserId: 'user-123',
        participantUserId: 'mentor-99',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      };
      const noFeedbackItem: Reservation = {
        ...mockReservation,
        id: 'hist-fallback',
        name: 'Fallback Mentor',
        senderUserId: 'user-123',
        participantUserId: 'mentor-98',
      };

      render(
        <ReservationList
          items={[answerItem, noFeedbackItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-123"
        />
      );

      expect(screen.getAllByRole('button', { name: '填寫回饋' })).toHaveLength(
        1
      );
      expect(screen.getAllByText('已結束')).toHaveLength(1);
    });

    it('defaults rated cards to collapsed 查看回饋 ⌄ and 評價未公開 ⌄, expands on click to show rating/notice & #731 編輯, and shows 未進行 for absent sessions', () => {
      const items: Reservation[] = [
        {
          ...mockReservation,
          id: 'hist-public',
          name: 'Public Mentor',
          feedback: {
            meetingHappened: true,
            rating: {
              rating: 10,
              content: '公開好評內容',
              createdAt: 1760000000,
              updatedAt: 1760000000,
              authorName: '王＊明',
              isPublic: true,
            },
            nextStep: null,
          },
        },
        {
          ...mockReservation,
          id: 'hist-private',
          name: 'Unpublicized Mentor',
          feedback: {
            meetingHappened: false,
            rating: {
              rating: 8,
              content: '未公開評論',
              createdAt: 1760000000,
              updatedAt: 1760000000,
              authorName: '王＊明',
              isPublic: false,
            },
            nextStep: null,
          },
        },
        {
          ...mockReservation,
          id: 'hist-not-happened',
          name: 'Absent Mentor',
          feedback: {
            meetingHappened: false,
            rating: null,
            nextStep: null,
          },
        },
      ];

      render(
        <ReservationList
          items={items}
          variant="history"
          sourceRole="mentee"
          myUserId="user-123"
        />
      );

      // Default collapsed
      const viewFeedbackBtn = screen.getByRole('button', { name: '查看回饋' });
      expect(viewFeedbackBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('公開好評內容')).not.toBeInTheDocument();
      expect(screen.queryByText('尚未公開')).not.toBeInTheDocument();

      expect(screen.getByText('評價未公開')).toBeInTheDocument();
      const expandUnpubBtn = screen.getByRole('button', {
        name: '展開評價未公開說明',
      });
      expect(expandUnpubBtn).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByTestId('reservation-feedback-unpublicized')
      ).not.toBeInTheDocument();

      expect(screen.getByText('未進行')).toBeInTheDocument();

      // Expand public rating & unpublicized rating
      fireEvent.click(viewFeedbackBtn);
      expect(viewFeedbackBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('10 / 10')).toBeInTheDocument();
      expect(screen.getByText('公開好評內容')).toBeInTheDocument();

      fireEvent.click(expandUnpubBtn);
      expect(
        screen.getByRole('button', { name: '收合評價未公開說明' })
      ).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByTestId('reservation-feedback-unpublicized').textContent
      ).toContain(
        '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。'
      );

      // #731: Both rated cards expose 編輯 once expanded, absent card does not, and 刪除 never exists
      expect(screen.getAllByRole('button', { name: '編輯' })).toHaveLength(2);
      expect(
        screen.queryByRole('button', { name: /刪除/ })
      ).not.toBeInTheDocument();
    });

    it('never renders 編輯 or 刪除 buttons on Mentor history cards even after expanding 查看回饋 (#731)', () => {
      render(
        <ReservationList
          items={[
            {
              ...mockReservation,
              id: 'hist-mentor-public',
              feedback: {
                meetingHappened: true,
                rating: {
                  rating: 10,
                  content: '學員公開評價',
                  createdAt: 1760000000,
                  updatedAt: 1760000000,
                  authorName: '王＊明',
                  isPublic: true,
                },
                nextStep: null,
              },
            },
          ]}
          variant="history"
          sourceRole="mentor"
          myUserId="user-456"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '查看回饋' }));
      expect(screen.getByText('學員評價')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '編輯' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /刪除/ })
      ).not.toBeInTheDocument();
    });

    it('highlights, scrolls into view, and auto-expands feedback only for the matching highlightedReservationId card (#734)', () => {
      const scrollSpy = vi.fn();
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = scrollSpy;

      try {
        render(
          <ReservationList
            items={[
              {
                ...mockReservation,
                id: '400',
                name: '林雅婷',
                feedback: {
                  meetingHappened: true,
                  rating: null,
                  nextStep: null,
                },
              },
              {
                ...mockReservation,
                id: '401',
                name: '王小明',
                feedback: {
                  meetingHappened: true,
                  rating: {
                    rating: 10,
                    content: '謝謝導師清楚剖析設計系統架構與職涯方向！',
                    createdAt: 1760000000,
                    updatedAt: 1760000000,
                    authorName: '王＊明',
                    isPublic: true,
                  },
                  nextStep: null,
                },
              },
            ]}
            variant="history"
            sourceRole="mentor"
            myUserId="user-456"
            highlightedReservationId="401"
          />
        );

        const nonTargetCard = screen.getByTestId('reservation-card-400');
        const targetCard = screen.getByTestId('reservation-card-401');
        expect(nonTargetCard).toHaveAttribute('data-reservation-id', '400');
        expect(nonTargetCard).toHaveAttribute('data-highlighted', 'false');
        expect(targetCard).toHaveAttribute('data-reservation-id', '401');
        expect(targetCard).toHaveAttribute('data-highlighted', 'true');

        const toggleBtn = screen.getByRole('button', { name: '查看回饋' });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(
          screen.getByText('謝謝導師清楚剖析設計系統架構與職涯方向！')
        ).toBeInTheDocument();
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith(
          expect.objectContaining({ behavior: 'smooth', block: 'center' })
        );

        // User can still collapse the auto-expanded feedback without re-scrolling
        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(scrollSpy).toHaveBeenCalledTimes(1);
      } finally {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      }
    });

    it('respects reduced motion and dynamic highlight updates (#734)', () => {
      const scrollSpy = vi.fn(() => {
        expect(screen.getByText('動態展開評價內容')).toBeInTheDocument();
      });
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      const originalMatchMedia = window.matchMedia;
      Element.prototype.scrollIntoView = scrollSpy;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const items: Reservation[] = [
        {
          ...mockReservation,
          id: '401',
          name: '王小明',
          feedback: {
            meetingHappened: true,
            rating: {
              rating: 10,
              content: '動態展開評價內容',
              createdAt: 1760000000,
              updatedAt: 1760000000,
              authorName: '王＊明',
              isPublic: true,
            },
            nextStep: null,
          },
        },
      ];

      try {
        const { rerender } = render(
          <ReservationList
            items={items}
            variant="history"
            sourceRole="mentor"
            myUserId="user-456"
            highlightedReservationId="   "
          />
        );

        const card = screen.getByTestId('reservation-card-401');
        const toggleBtn = screen.getByRole('button', { name: '查看回饋' });
        expect(card).toHaveAttribute('data-highlighted', 'false');
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(scrollSpy).not.toHaveBeenCalled();

        rerender(
          <ReservationList
            items={items}
            variant="history"
            sourceRole="mentor"
            myUserId="user-456"
            highlightedReservationId=" 401 "
          />
        );

        expect(card).toHaveAttribute('data-highlighted', 'true');
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('動態展開評價內容')).toBeInTheDocument();
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith({
          behavior: 'auto',
          block: 'center',
        });

        // Manually collapse panel -> does not re-scroll while highlightNonce stays 0
        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
        expect(scrollSpy).toHaveBeenCalledTimes(1);

        // Repeated click on notification increments highlightNonce -> re-expands and re-scrolls
        rerender(
          <ReservationList
            items={items}
            variant="history"
            sourceRole="mentor"
            myUserId="user-456"
            highlightedReservationId=" 401 "
            highlightNonce={1}
          />
        );
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        expect(scrollSpy).toHaveBeenCalledTimes(2);
      } finally {
        Element.prototype.scrollIntoView = originalScrollIntoView;
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          configurable: true,
          value: originalMatchMedia,
        });
      }
    });
  });
});

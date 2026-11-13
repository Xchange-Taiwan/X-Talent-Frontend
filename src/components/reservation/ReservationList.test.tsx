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
const {
  mockUpdateReservationStatus,
  mockSubmitReservationFeedback,
  mockToast,
} = vi.hoisted(() => {
  return {
    mockUpdateReservationStatus: vi.fn().mockResolvedValue({}),
    mockSubmitReservationFeedback: vi.fn().mockResolvedValue(undefined),
    mockToast: vi.fn(),
  };
});

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    updateReservationStatus: mockUpdateReservationStatus,
    submitReservationFeedback: mockSubmitReservationFeedback,
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
    toast: mockToast,
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
  }: {
    headerAction?: React.ReactNode;
    feedbackContent?: React.ReactNode;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    item: { id: string; name: string };
    profileHref?: string;
  }) => (
    <div
      data-testid={`reservation-card-${item.id}`}
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

    it('never renders 編輯 or 刪除 buttons on Mentor history cards even after expanding 查看紀錄 (#731, #735)', () => {
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

      fireEvent.click(screen.getByRole('button', { name: '查看紀錄' }));
      expect(screen.getByText('學員評價')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-feedback-meta')).toHaveTextContent(
        '王＊明'
      );
      expect(screen.getByTestId('mentor-feedback-meta')).toHaveTextContent(
        '10 / 10'
      );
      expect(
        screen.queryByRole('button', { name: '編輯' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /刪除/ })
      ).not.toBeInTheDocument();
    });

    it('highlights target card and auto-expands existing feedback block when highlightedReservationId and autoExpandedReservationId match (#733)', () => {
      const ratedItem = {
        ...mockReservation,
        id: 'hist-deeplink-rated',
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 9,
            content: '深連結自動展開的回饋內容',
            createdAt: 1760000000,
            updatedAt: 1760000000,
            authorName: '王＊明',
            isPublic: true,
          },
          nextStep: null,
        },
      };

      const { container } = render(
        <ReservationList
          items={[ratedItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-456"
          highlightedReservationId="hist-deeplink-rated"
          autoExpandedReservationId="hist-deeplink-rated"
        />
      );

      const wrapper = container.querySelector(
        '[data-reservation-id="hist-deeplink-rated"]'
      );
      expect(wrapper).toHaveAttribute('data-highlighted', 'true');
      expect(screen.getByText('深連結自動展開的回饋內容')).toBeInTheDocument();
    });

    it('re-scrolls and re-expands collapsed feedback block when deepLinkTriggerSeq increments for the same card (#733)', () => {
      const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      const scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      try {
        const ratedItem: Reservation = {
          ...mockReservation,
          id: 'hist-deeplink-repeat',
          feedback: {
            meetingHappened: true,
            rating: {
              rating: 10,
              content: '重複點擊通知自動重展開內容',
              createdAt: 1760000000,
              updatedAt: 1760000000,
              authorName: '王＊明',
              isPublic: true,
            },
            nextStep: null,
          },
        };

        const { rerender } = render(
          <ReservationList
            items={[ratedItem]}
            variant="history"
            sourceRole="mentee"
            myUserId="user-456"
            highlightedReservationId="hist-deeplink-repeat"
            autoExpandedReservationId="hist-deeplink-repeat"
            deepLinkTriggerSeq={1}
          />
        );

        expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
        expect(
          screen.getByText('重複點擊通知自動重展開內容')
        ).toBeInTheDocument();

        // User manually collapses feedback block
        fireEvent.click(screen.getByRole('button', { name: '查看回饋' }));
        expect(
          screen.queryByText('重複點擊通知自動重展開內容')
        ).not.toBeInTheDocument();

        // User clicks the same notification again -> deepLinkTriggerSeq increments
        rerender(
          <ReservationList
            items={[ratedItem]}
            variant="history"
            sourceRole="mentee"
            myUserId="user-456"
            highlightedReservationId="hist-deeplink-repeat"
            autoExpandedReservationId="hist-deeplink-repeat"
            deepLinkTriggerSeq={2}
          />
        );

        expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
        expect(
          screen.getByText('重複點擊通知自動重展開內容')
        ).toBeInTheDocument();
      } finally {
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      }
    });

    it('auto-opens single-session MeetingFeedbackDialog when deepLinkDialogReservation is provided for Mentee history (#733)', () => {
      const pendingItem = {
        ...mockReservation,
        id: 'hist-deeplink-pending',
        name: 'Emily Chen',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER' as const,
        },
      };

      render(
        <ReservationList
          items={[pendingItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-456"
          deepLinkDialogReservation={pendingItem}
          highlightedReservationId="hist-deeplink-pending"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('這場會談是否順利進行？')).toBeInTheDocument();
    });

    it('auto-opens single-session MeetingFeedbackDialog on rating step when deepLinkDialogReservation has nextStep === RATE (#733)', () => {
      const pendingRateItem: Reservation = {
        ...mockReservation,
        id: 'hist-deeplink-rate',
        name: 'Emily Chen',
        feedback: {
          meetingHappened: true,
          rating: null,
          nextStep: 'RATE',
        },
      };

      render(
        <ReservationList
          items={[pendingRateItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-456"
          deepLinkDialogReservation={pendingRateItem}
          highlightedReservationId="hist-deeplink-rate"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('步驟 2 / 2 · 交流回饋')).toBeInTheDocument();
      expect(screen.getByText('為本次會議評分')).toBeInTheDocument();
    });

    it('invokes onDeepLinkDialogClose and closes cleanly without already-rated toast after submitting feedback via MenteeDeepLinkFeedbackDialog (#733)', async () => {
      const onDeepLinkDialogClose = vi.fn();
      const pendingItem: Reservation = {
        ...mockReservation,
        id: 'hist-deeplink-submit',
        name: 'Emily Chen',
        senderUserId: 'user-123',
        participantUserId: 'user-456',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      };

      const ratedItem: Reservation = {
        ...pendingItem,
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 9,
            content: '深連結回饋送出測試',
            createdAt: 1760000100,
            updatedAt: 1760000100,
            authorName: 'T***',
            isPublic: true,
          },
          nextStep: null,
        },
      };

      const { rerender } = render(
        <ReservationList
          items={[pendingItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-123"
          deepLinkDialogReservation={pendingItem}
          onDeepLinkDialogClose={onDeepLinkDialogClose}
          highlightedReservationId="hist-deeplink-submit"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
      fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

      fireEvent.click(screen.getByRole('radio', { name: '9 分' }));
      fireEvent.change(screen.getByLabelText(/文字回饋/), {
        target: { value: '深連結回饋送出測試' },
      });
      fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

      await waitFor(() => {
        expect(mockSubmitReservationFeedback).toHaveBeenCalledWith({
          reservation: pendingItem,
          myUserId: 'user-123',
          myRole: 'mentee',
          payload: {
            meeting_happened: true,
            feedback: {
              rating: 9,
              content: '深連結回饋送出測試',
            },
          },
        });
      });

      await waitFor(() => {
        expect(onDeepLinkDialogClose).toHaveBeenCalledTimes(1);
      });

      // Simulate parent clearing deepLinkDialogReservation and refreshing history to rated state
      rerender(
        <ReservationList
          items={[ratedItem]}
          variant="history"
          sourceRole="mentee"
          myUserId="user-123"
          deepLinkDialogReservation={null}
          onDeepLinkDialogClose={onDeepLinkDialogClose}
          highlightedReservationId="hist-deeplink-submit"
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith({
        title: '已送出',
        description: 'X-Talent 已收到您的回饋，謝謝您！',
      });
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: '您已填寫過此場會談回饋',
        })
      );
    });

    it('renders 確認會談 on pending Mentor history cards (showing received public rating immediately), submits Mentor 2-page flow, and auto-opens via deepLinkDialogReservation (#735)', async () => {
      const pendingMentorWithRating: Reservation = {
        ...mockReservation,
        id: 'mentor-pending-735',
        viewerRole: 'MENTOR',
        feedback: {
          meetingHappened: null,
          rating: {
            rating: 9,
            content: '很感謝導師提供清楚的面試建議！',
            createdAt: 1761609600,
            updatedAt: 1761609600,
            authorName: '林＊員',
            isPublic: true,
          },
          nextStep: 'ANSWER',
        },
      };

      const onDeepLinkDialogClose = vi.fn();

      render(
        <ReservationList
          items={[pendingMentorWithRating]}
          variant="history"
          sourceRole="mentor"
          myUserId="user-456"
          deepLinkDialogReservation={pendingMentorWithRating}
          onDeepLinkDialogClose={onDeepLinkDialogClose}
          highlightedReservationId="mentor-pending-735"
        />
      );

      // Public rating is immediately visible on the Mentor card even before Mentor confirms attendance
      expect(
        screen.getByText('很感謝導師提供清楚的面試建議！')
      ).toBeInTheDocument();
      expect(screen.getByTestId('mentor-feedback-meta')).toHaveTextContent(
        '林＊員'
      );

      // Deep link auto-opens Mentor 確認會談 modal
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-dialog-title')).toHaveTextContent(
        '確認會談'
      );

      // Choose 沒有進行 -> 下一步 -> Step 2 with 5 reasons (without 誰沒有進行會談) + warning box -> 送出
      fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));

      expect(screen.queryByText(/誰沒有進行會談/)).not.toBeInTheDocument();
      expect(
        screen.getByTestId('mentor-not-happened-warning')
      ).toHaveTextContent(
        '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。'
      );

      fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
      fireEvent.click(screen.getByRole('button', { name: '送出' }));

      await waitFor(() => {
        expect(mockSubmitReservationFeedback).toHaveBeenCalledWith({
          reservation: pendingMentorWithRating,
          myUserId: 'user-456',
          myRole: 'mentor',
          payload: {
            meeting_happened: false,
            not_happened_reason: 'COUNTERPART_ABSENT',
          },
        });
      });

      await waitFor(() => {
        expect(onDeepLinkDialogClose).toHaveBeenCalledTimes(1);
      });
    });
  });
});

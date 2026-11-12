import type { Reservation } from '@/types/reservation';

export const UNPUBLICIZED_FEEDBACK_NOTICE =
  '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。';

export type HistoryHeaderAction =
  | { kind: 'answer-button' }
  | { kind: 'feedback-toggle'; label: '查看回饋' }
  | {
      kind: 'unpublicized-toggle';
      badgeLabel: '評價未公開';
      expandTooltip: '展開評價未公開說明';
      collapseTooltip: '收合評價未公開說明';
    }
  | { kind: 'badge'; label: string };

export type HistoryFeedbackBlockModel =
  | {
      kind: 'public-rating';
      label: '我的回饋' | '學員評價';
      rating: number;
      content: string;
      canEdit?: boolean;
    }
  | {
      kind: 'unpublicized';
      rating: number;
      content: string;
      notice: string;
      canEdit?: boolean;
    };

export interface HistoryFeedbackState {
  headerAction: HistoryHeaderAction;
  bottomStatusLabel?: string;
  feedbackBlock: HistoryFeedbackBlockModel | null;
}

export function filterPendingFeedbackQueueItems(
  items: readonly Reservation[]
): Reservation[] {
  return items.filter(
    (item) => !item.cancelledBy && item.feedback?.nextStep === 'ANSWER'
  );
}

export function resolveHistoryFeedbackState(opts: {
  reservation: Reservation;
  sourceRole: 'mentee' | 'mentor';
  cancelledByLabel?: string;
}): HistoryFeedbackState {
  const { reservation, sourceRole, cancelledByLabel } = opts;

  if (cancelledByLabel) {
    return {
      headerAction: { kind: 'badge', label: cancelledByLabel },
      feedbackBlock: null,
    };
  }

  const feedback = reservation.feedback;

  if (sourceRole === 'mentee') {
    if (feedback?.nextStep === 'ANSWER') {
      return {
        headerAction: { kind: 'answer-button' },
        feedbackBlock: null,
      };
    }

    if (feedback?.rating) {
      if (feedback.rating.isPublic === false) {
        return {
          headerAction: {
            kind: 'unpublicized-toggle',
            badgeLabel: '評價未公開',
            expandTooltip: '展開評價未公開說明',
            collapseTooltip: '收合評價未公開說明',
          },
          feedbackBlock: {
            kind: 'unpublicized',
            rating: feedback.rating.rating,
            content: feedback.rating.content,
            notice: UNPUBLICIZED_FEEDBACK_NOTICE,
            canEdit: true,
          },
        };
      }

      return {
        headerAction: { kind: 'feedback-toggle', label: '查看回饋' },
        feedbackBlock: {
          kind: 'public-rating',
          label: '我的回饋',
          rating: feedback.rating.rating,
          content: feedback.rating.content,
          canEdit: true,
        },
      };
    }

    if (feedback?.meetingHappened === false) {
      return {
        headerAction: { kind: 'badge', label: '未進行' },
        feedbackBlock: null,
      };
    }

    return {
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: null,
    };
  }

  // Mentor view: show '未進行' if marked not happened, or collapsible public mentee review
  if (feedback?.meetingHappened === false) {
    return {
      headerAction: { kind: 'badge', label: '未進行' },
      feedbackBlock: null,
    };
  }

  if (feedback?.rating && feedback.rating.isPublic !== false) {
    return {
      headerAction: { kind: 'feedback-toggle', label: '查看回饋' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: feedback.rating.rating,
        content: feedback.rating.content,
        canEdit: false,
      },
    };
  }

  return {
    headerAction: { kind: 'badge', label: '已結束' },
    feedbackBlock: null,
  };
}

import type { Reservation } from '@/types/reservation';

export const UNPUBLICIZED_FEEDBACK_NOTICE =
  '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。';

export type HistoryHeaderAction =
  { kind: 'answer-button' } | { kind: 'badge'; label: string };

export type HistoryFeedbackBlockModel =
  | {
      kind: 'public-rating';
      label: '我的評價' | '學員評價';
      rating: number;
      content: string;
    }
  | {
      kind: 'unpublicized';
      rating: number;
      content: string;
      notice: string;
    };

export interface HistoryFeedbackState {
  headerAction: HistoryHeaderAction;
  /**
   * Rendered in the bottom-right slot when the top-right slot is occupied by
   * the `填寫回饋` CTA button (1.h swap between `填寫回饋` and `Session Completed` / `已結束`).
   */
  bottomStatusLabel?: string;
  feedbackBlock: HistoryFeedbackBlockModel | null;
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
        bottomStatusLabel: '已結束',
        feedbackBlock: null,
      };
    }

    if (feedback?.rating) {
      if (feedback.rating.isPublic === false) {
        return {
          headerAction: { kind: 'badge', label: '評價未公開' },
          feedbackBlock: {
            kind: 'unpublicized',
            rating: feedback.rating.rating,
            content: feedback.rating.content,
            notice: UNPUBLICIZED_FEEDBACK_NOTICE,
          },
        };
      }

      return {
        headerAction: { kind: 'badge', label: '已填寫' },
        feedbackBlock: {
          kind: 'public-rating',
          label: '我的評價',
          rating: feedback.rating.rating,
          content: feedback.rating.content,
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

  // Mentor view: show '未進行' if marked not happened, or public mentee review
  if (feedback?.meetingHappened === false) {
    return {
      headerAction: { kind: 'badge', label: '未進行' },
      feedbackBlock: null,
    };
  }

  if (feedback?.rating && feedback.rating.isPublic !== false) {
    return {
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: feedback.rating.rating,
        content: feedback.rating.content,
      },
    };
  }

  return {
    headerAction: { kind: 'badge', label: '已結束' },
    feedbackBlock: null,
  };
}

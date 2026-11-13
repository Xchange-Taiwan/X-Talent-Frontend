import {
  formatAuthorMaskedName,
  formatFeedbackDate,
} from '@/lib/mentor/mentorStats';
import type { Reservation } from '@/types/reservation';
import type { ReservationFeedback } from '@/types/reservationFeedback';

export const UNPUBLICIZED_FEEDBACK_NOTICE =
  '這場會談已被標註沒有進行，因此評價不會公開；如有疑問可以透過回饋表單聯繫我們。';

export type HistoryHeaderAction =
  | { kind: 'answer-button' }
  | { kind: 'feedback-toggle'; label: '查看回饋' | '查看紀錄' }
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
      authorMaskedName?: string;
      formattedDate?: string;
      mentorAttendanceLabel?: string;
      canEdit?: boolean;
    }
  | {
      kind: 'unpublicized';
      rating: number;
      content: string;
      notice: string;
      canEdit?: boolean;
    }
  | {
      kind: 'mentor-record';
      attendanceLabel: string;
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

function resolveMentorOwnAttendance(
  feedback: ReservationFeedback | undefined
): 'pending' | 'happened' | 'not-happened' | 'unknown' {
  if (!feedback) {
    return 'unknown';
  }
  if (feedback.nextStep === 'ANSWER') {
    return 'pending';
  }
  if (feedback.myMeetingHappened === true) {
    return 'happened';
  }
  if (feedback.myMeetingHappened === false) {
    return 'not-happened';
  }
  return 'unknown';
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
    if (feedback?.nextStep === 'ANSWER' || feedback?.nextStep === 'RATE') {
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

  // Mentor view (#735):
  // 1. Only reflect Mentor's own attendance answer (never reveal Mentee's attendance answer).
  // 2. Display received public rating (masked name · score/10 · date + content) only when
  //    neither party answered not-happened and rating.isPublic !== false.
  const ownAttendance = resolveMentorOwnAttendance(feedback);
  const rating = feedback?.rating;
  const isSessionMarkedNotHappened =
    ownAttendance === 'not-happened' || feedback?.meetingHappened === false;
  const hasPublicMenteeRating = Boolean(
    !isSessionMarkedNotHappened && rating && rating.isPublic !== false
  );

  const publicRatingBlock: Extract<
    HistoryFeedbackBlockModel,
    { kind: 'public-rating' }
  > | null =
    hasPublicMenteeRating && rating
      ? {
          kind: 'public-rating',
          label: '學員評價',
          rating: rating.rating,
          content: rating.content,
          authorMaskedName: formatAuthorMaskedName(rating.authorName),
          formattedDate: formatFeedbackDate(
            rating.createdAt || rating.updatedAt
          ),
          canEdit: false,
        }
      : null;

  if (ownAttendance === 'pending') {
    return {
      headerAction: { kind: 'answer-button' },
      feedbackBlock: publicRatingBlock,
    };
  }

  if (ownAttendance === 'not-happened') {
    return {
      headerAction: { kind: 'badge', label: '未進行' },
      feedbackBlock: null,
    };
  }

  if (ownAttendance === 'happened') {
    return {
      headerAction: { kind: 'feedback-toggle', label: '查看紀錄' },
      feedbackBlock: publicRatingBlock
        ? {
            ...publicRatingBlock,
            mentorAttendanceLabel: '已回報：有進行',
          }
        : {
            kind: 'mentor-record',
            attendanceLabel: '已回報：有進行',
          },
    };
  }

  if (publicRatingBlock) {
    return {
      headerAction: { kind: 'feedback-toggle', label: '查看紀錄' },
      feedbackBlock: publicRatingBlock,
    };
  }

  return {
    headerAction: { kind: 'badge', label: '已結束' },
    feedbackBlock: null,
  };
}

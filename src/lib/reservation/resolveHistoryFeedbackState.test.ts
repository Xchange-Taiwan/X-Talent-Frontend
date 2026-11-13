import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  filterPendingFeedbackQueueItems,
  resolveHistoryFeedbackState,
  UNPUBLICIZED_FEEDBACK_NOTICE,
} from './resolveHistoryFeedbackState';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return fromPartial<Reservation>({
    id: 'res-1',
    name: 'Emily Chen',
    roleLine: 'UI/UX Designer',
    date: '2026/10/20',
    time: '19:00–19:30',
    messages: [],
    scheduleId: 1,
    dtstart: 1760000000,
    dtend: 1760001800,
    senderUserId: 1,
    participantUserId: 2,
    version: 0,
    ...overrides,
  });
}

describe('resolveHistoryFeedbackState', () => {
  it('prioritizes cancelledByLabel over any feedback state', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({
        cancelledBy: 'MENTOR',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentee',
      cancelledByLabel: '已由導師取消',
    });

    expect(state).toEqual({
      headerAction: { kind: 'badge', label: '已由導師取消' },
      feedbackBlock: null,
    });
  });

  it('places 填寫回饋 CTA in top-right without duplicating status badge inside card (#730 Design Hub)', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentee',
    });

    expect(state).toEqual({
      headerAction: { kind: 'answer-button' },
      feedbackBlock: null,
    });

    const rateState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          rating: null,
          nextStep: 'RATE',
        },
      }),
      sourceRole: 'mentee',
    });

    expect(rateState).toEqual({
      headerAction: { kind: 'answer-button' },
      feedbackBlock: null,
    });
  });

  it('shows collapsible 查看回饋 toggle and editable public rating when mentee submitted rating with isPublic=true (no 尚未公開)', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 10,
            content: '非常棒的交流！',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '王＊明',
            isPublic: true,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentee',
    });

    expect(state).toEqual({
      headerAction: { kind: 'feedback-toggle', label: '查看回饋' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '我的回饋',
        rating: 10,
        content: '非常棒的交流！',
        canEdit: true,
      },
    });
  });

  it('shows warm-yellow 評價未公開 collapsible toggle with tooltips and explanation notice when rating.isPublic === false (#734)', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          rating: {
            rating: 8,
            content: '謝謝分享',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '王＊明',
            isPublic: false,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentee',
    });

    expect(state).toEqual({
      headerAction: {
        kind: 'unpublicized-toggle',
        badgeLabel: '評價未公開',
        expandTooltip: '展開評價未公開說明',
        collapseTooltip: '收合評價未公開說明',
      },
      feedbackBlock: {
        kind: 'unpublicized',
        rating: 8,
        content: '謝謝分享',
        notice: UNPUBLICIZED_FEEDBACK_NOTICE,
        canEdit: true,
      },
    });
  });

  it('shows 未進行 when meetingHappened === false and no rating exists', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          rating: null,
          nextStep: null,
        },
      }),
      sourceRole: 'mentee',
    });

    expect(state).toEqual({
      headerAction: { kind: 'badge', label: '未進行' },
      feedbackBlock: null,
    });
  });

  it('gracefully hides 填寫回饋 and shows 已結束 when backend has not returned feedback field yet', () => {
    const state = resolveHistoryFeedbackState({
      reservation: makeReservation({ feedback: undefined }),
      sourceRole: 'mentee',
    });

    expect(state).toEqual({
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: null,
    });
  });

  it('renders collapsible 查看回饋 public mentee review on mentor history card and hides unpublicized reviews', () => {
    const publicMentorState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 9,
            content: '收穫良多！',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '林＊華',
            isPublic: true,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentor',
    });

    expect(publicMentorState).toEqual({
      headerAction: { kind: 'feedback-toggle', label: '查看回饋' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 9,
        content: '收穫良多！',
        canEdit: false,
      },
    });

    const notHappenedMentorState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          rating: {
            rating: 9,
            content: '未公開內容',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '林＊華',
            isPublic: false,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentor',
    });

    expect(notHappenedMentorState).toEqual({
      headerAction: { kind: 'badge', label: '未進行' },
      feedbackBlock: null,
    });

    const pendingMentorAttendanceState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentor',
    });

    expect(pendingMentorAttendanceState).toEqual({
      headerAction: { kind: 'answer-button' },
      feedbackBlock: null,
    });

    const ratedPendingMentorAttendanceState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: null,
          rating: {
            rating: 9,
            content: '學員已先評分',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '林＊華',
            isPublic: true,
          },
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentor',
    });

    expect(ratedPendingMentorAttendanceState).toEqual({
      headerAction: { kind: 'feedback-toggle', label: '查看回饋' },
      canReportAttendance: true,
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 9,
        content: '學員已先評分',
        canEdit: false,
      },
    });
  });

  it('filters only uncancelled history items with nextStep === "ANSWER" for pending feedback queue', () => {
    const answerItem = makeReservation({
      id: 'res-answer',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    const cancelledAnswerItem = makeReservation({
      id: 'res-cancelled',
      cancelledBy: 'MENTOR',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });
    const ratedItem = makeReservation({
      id: 'res-rated',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 10,
          content: '好評',
          createdAt: 1760002000,
          updatedAt: 1760002000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    expect(
      filterPendingFeedbackQueueItems([
        answerItem,
        cancelledAnswerItem,
        ratedItem,
      ])
    ).toEqual([answerItem]);
  });
});

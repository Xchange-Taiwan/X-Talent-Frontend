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

    const rateStepState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          rating: null,
          nextStep: 'RATE',
        },
      }),
      sourceRole: 'mentee',
    });

    expect(rateStepState).toEqual({
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

  it('renders Mentor history card states (#735): 確認會談 when pending, 查看紀錄 with masked name · score/10 · date, non-leaking 查看紀錄 when Mentee answered not-happened, and 未進行 when Mentor answered not-happened', () => {
    // 1. Mentor pending without Mentee rating -> 確認會談 button, no feedbackBlock
    const pendingNoRatingState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentor',
    });
    expect(pendingNoRatingState).toEqual({
      headerAction: { kind: 'answer-button' },
      feedbackBlock: null,
    });

    // 2. Mentor pending WITH public Mentee rating -> 確認會談 button stays open AND public rating is immediately visible
    const pendingWithPublicRatingState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: null,
          rating: {
            rating: 10,
            content: '謝謝導師清楚剖析設計系統架構！',
            createdAt: 1761609600,
            updatedAt: 1761609600,
            authorName: '王＊明',
            isPublic: true,
          },
          nextStep: 'ANSWER',
        },
      }),
      sourceRole: 'mentor',
    });
    expect(pendingWithPublicRatingState).toEqual({
      headerAction: { kind: 'answer-button' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 10,
        content: '謝謝導師清楚剖析設計系統架構！',
        authorMaskedName: '王＊明',
        formattedDate: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}$/),
        canEdit: false,
      },
    });

    // 3. Mentor answered 有進行 + public Mentee rating -> 查看紀錄 toggle + 已回報：有進行 + masked name · score/10 · date
    const publicMentorState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          myMeetingHappened: true,
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
      headerAction: { kind: 'feedback-toggle', label: '查看紀錄' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 9,
        content: '收穫良多！',
        authorMaskedName: '林＊華',
        formattedDate: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}$/),
        mentorAttendanceLabel: '已回報：有進行',
        canEdit: false,
      },
    });

    // 4. Mentor answered 有進行, Mentee answered 沒有進行 (aggregate meetingHappened=false, myMeetingHappened=true) ->
    // MUST still show 查看紀錄 (own answer) and hide unpublicized rating without leaking Mentee's attendance answer!
    const mentorYesMenteeNoState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          myMeetingHappened: true,
          rating: {
            rating: 8,
            content: '不應顯示的未公開回饋',
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

    expect(mentorYesMenteeNoState).toEqual({
      headerAction: { kind: 'feedback-toggle', label: '查看紀錄' },
      feedbackBlock: {
        kind: 'mentor-record',
        attendanceLabel: '已回報：有進行',
      },
    });

    // 5. Mentor answered 沒有進行 -> locked 未進行 badge and hidden rating
    const notHappenedMentorState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          myMeetingHappened: false,
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

    // 6. Mentor never answered (myMeetingHappened: null / undefined, nextStep: null) while Mentee answered 沒有進行 ->
    // MUST fall back to 已結束 without leaking Mentee's 未進行 answer or unpublicized rating!
    const mentorUnansweredMenteeNoState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: false,
          myMeetingHappened: null,
          rating: {
            rating: 7,
            content: '未公開評論',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '陳＊明',
            isPublic: false,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentor',
    });

    expect(mentorUnansweredMenteeNoState).toEqual({
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: null,
    });

    // 7. Mentor never answered (myMeetingHappened: null, nextStep: null) while Mentee answered 有進行 without rating ->
    // MUST render 已結束 with null feedbackBlock (never fabricate 查看紀錄 / 已回報：有進行)
    const mentorUnansweredNoRatingState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          myMeetingHappened: null,
          rating: null,
          nextStep: null,
        },
      }),
      sourceRole: 'mentor',
    });

    expect(mentorUnansweredNoRatingState).toEqual({
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: null,
    });

    // 8. Mentor never answered (myMeetingHappened: null, nextStep: null) while Mentee left a public rating ->
    // Shows 查看紀錄 with public rating, WITHOUT fabricating mentorAttendanceLabel ('已回報：有進行')
    const mentorUnansweredPublicRatingState = resolveHistoryFeedbackState({
      reservation: makeReservation({
        feedback: {
          meetingHappened: true,
          myMeetingHappened: null,
          rating: {
            rating: 10,
            content: '非常實用的職涯建議！',
            createdAt: 1760002000,
            updatedAt: 1760002000,
            authorName: '張＊婷',
            isPublic: true,
          },
          nextStep: null,
        },
      }),
      sourceRole: 'mentor',
    });

    expect(mentorUnansweredPublicRatingState).toEqual({
      headerAction: { kind: 'feedback-toggle', label: '查看紀錄' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 10,
        content: '非常實用的職涯建議！',
        authorMaskedName: '張＊婷',
        formattedDate: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}$/),
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

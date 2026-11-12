import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
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

  it('swaps 填寫回饋 to top-right and 已結束 to bottom-right when mentee nextStep is ANSWER (#730 1.h)', () => {
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
      bottomStatusLabel: '已結束',
      feedbackBlock: null,
    });
  });

  it('shows 已填寫 and public rating when mentee submitted rating with isPublic=true (no 尚未公開)', () => {
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
      headerAction: { kind: 'badge', label: '已填寫' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '我的評價',
        rating: 10,
        content: '非常棒的交流！',
      },
    });
  });

  it('shows 評價未公開 (not 已填寫) and explanation notice when rating.isPublic === false (2026-11-11 decision)', () => {
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
      headerAction: { kind: 'badge', label: '評價未公開' },
      feedbackBlock: {
        kind: 'unpublicized',
        rating: 8,
        content: '謝謝分享',
        notice: UNPUBLICIZED_FEEDBACK_NOTICE,
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

  it('renders public mentee review on mentor history card and hides unpublicized reviews', () => {
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
      headerAction: { kind: 'badge', label: '已結束' },
      feedbackBlock: {
        kind: 'public-rating',
        label: '學員評價',
        rating: 9,
        content: '收穫良多！',
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
  });
});

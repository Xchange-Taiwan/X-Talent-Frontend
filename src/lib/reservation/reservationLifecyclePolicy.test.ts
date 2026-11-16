import fs from 'node:fs';
import path from 'node:path';

import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import { shouldSuppressPendingFeedbackPopup } from '@/lib/reservation/pendingFeedbackGuard';
import type { Reservation } from '@/types/reservation';
import type { ReservationFeedback } from '@/types/reservationFeedback';

import {
  canEditReservationFeedback,
  canOpenHistoryConversation,
  canSubmitReservationFeedback,
  evaluateReservationTimePhase,
  filterActiveTabReservations,
  hasExpandableMentorFeedback,
  isEligibleForPendingFeedbackQueue,
  isMenteeSessionMarkedNotHappened,
  isPublicRatingVisibleToMentor,
  isReservationCancelled,
  isSystemAutoCancelled,
  partitionReservationTabSlices,
  resolveCancelledBy,
  resolveCancelledByLabel,
  resolveEffectiveFeedbackRole,
  resolveFeedbackDialogStep,
  resolveFeedbackInitialStep,
  resolveMentorOwnAttendance,
  resolveSystemAutoCancelNotice,
} from './reservationLifecyclePolicy';

const NOW_S = 1_760_000_000;
const NOW_MS = NOW_S * 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return fromPartial<Reservation>({
    id: 'res-1',
    name: 'Emily Chen',
    roleLine: 'Senior UX Designer, 5~10 年',
    date: '2026/10/20',
    time: '19:00–19:30',
    messages: [],
    scheduleId: 100,
    dtstart: NOW_S - 2 * HOUR,
    dtend: NOW_S - HOUR,
    senderUserId: 10,
    participantUserId: 20,
    version: 0,
    ...overrides,
  });
}

describe('reservationLifecyclePolicy (#881)', () => {
  describe('pure domain module boundary', () => {
    it('contains zero react, next/*, next-auth/*, or @/hooks/** imports', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, 'reservationLifecyclePolicy.ts'),
        'utf8'
      );

      expect(source).not.toMatch(/from\s+['"]react['"]/);
      expect(source).not.toMatch(/from\s+['"]next(?:\/|['"])/);
      expect(source).not.toMatch(/from\s+['"]next-auth(?:\/|['"])/);
      expect(source).not.toMatch(/from\s+['"]@\/hooks\//);
    });
  });

  describe('evaluateReservationTimePhase (table-driven)', () => {
    it.each([
      {
        name: 'past dtend -> ended (已結束)',
        dtstart: NOW_S - HOUR,
        dtend: NOW_S - MINUTE,
        expected: { status: 'ended', label: '已結束' },
      },
      {
        name: 'exact dtend boundary -> ended (已結束)',
        dtstart: NOW_S - HOUR,
        dtend: NOW_S,
        expected: { status: 'ended', label: '已結束' },
      },
      {
        name: 'exact dtstart boundary -> live (進行中)',
        dtstart: NOW_S,
        dtend: NOW_S + HOUR,
        expected: { status: 'live', label: '進行中' },
      },
      {
        name: 'between dtstart and dtend -> live (進行中)',
        dtstart: NOW_S - 15 * MINUTE,
        dtend: NOW_S + 15 * MINUTE,
        expected: { status: 'live', label: '進行中' },
      },
      {
        name: 'sub-minute before start -> imminent (即將開始)',
        dtstart: NOW_S + 45,
        dtend: NOW_S + HOUR,
        expected: { status: 'imminent', label: '即將開始' },
      },
      {
        name: 'minutes before start -> imminent (N 分鐘後開始)',
        dtstart: NOW_S + 15 * MINUTE,
        dtend: NOW_S + HOUR,
        expected: { status: 'imminent', label: '15 分鐘後開始' },
      },
      {
        name: 'hours before start -> soon (N 小時後開始)',
        dtstart: NOW_S + 3 * HOUR + 20 * MINUTE,
        dtend: NOW_S + 4 * HOUR,
        expected: { status: 'soon', label: '3 小時後開始' },
      },
      {
        name: 'days before start -> far (N 天後)',
        dtstart: NOW_S + 2 * DAY + 5 * HOUR,
        dtend: NOW_S + 2 * DAY + 6 * HOUR,
        expected: { status: 'far', label: '2 天後' },
      },
    ])('$name', ({ dtstart, dtend, expected }) => {
      expect(evaluateReservationTimePhase(dtstart, dtend, NOW_MS)).toEqual(
        expected
      );
    });
  });

  describe('SYSTEM 24h auto-cancel vs participant cancel precedence', () => {
    it.each([
      {
        scenario:
          'explicit SYSTEM 24h timeout auto-cancel overrides any participant REJECT status',
        input: {
          explicitCancelledBy: 'SYSTEM',
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'REJECT',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'REJECT',
        },
        expected: 'SYSTEM',
        expectedLabel: '已自動取消',
      },
      {
        scenario:
          'explicit SYSTEM auto-cancel while participant statuses remain PENDING (24h unconfirmed timeout)',
        input: {
          explicitCancelledBy: 'SYSTEM',
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'PENDING',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'PENDING',
        },
        expected: 'SYSTEM',
        expectedLabel: '已自動取消',
      },
      {
        scenario:
          'explicit wire MENTOR overrides participant fallback derivation',
        input: {
          explicitCancelledBy: 'MENTOR',
          counterpartyRole: 'MENTEE',
          counterpartyStatus: 'ACCEPT',
          currentUserRole: 'MENTOR',
          currentUserStatus: 'ACCEPT',
        },
        expected: 'MENTOR',
        expectedLabel: '已由導師取消',
      },
      {
        scenario:
          'explicit wire MENTEE overrides participant fallback derivation',
        input: {
          explicitCancelledBy: 'MENTEE',
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'ACCEPT',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'ACCEPT',
        },
        expected: 'MENTEE',
        expectedLabel: '已由學員取消',
      },
      {
        scenario:
          'both sides marked REJECT without explicit cancelled_by -> counterparty (other side) wins',
        input: {
          explicitCancelledBy: null,
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'REJECT',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'REJECT',
        },
        expected: 'MENTOR',
        expectedLabel: '已由導師取消',
      },
      {
        scenario:
          'only current user marked REJECT -> resolves to current user role',
        input: {
          explicitCancelledBy: undefined,
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'ACCEPT',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'REJECT',
        },
        expected: 'MENTEE',
        expectedLabel: '已由學員取消',
      },
      {
        scenario: 'uncancelled active reservation -> undefined',
        input: {
          explicitCancelledBy: null,
          counterpartyRole: 'MENTOR',
          counterpartyStatus: 'ACCEPT',
          currentUserRole: 'MENTEE',
          currentUserStatus: 'ACCEPT',
        },
        expected: undefined,
        expectedLabel: undefined,
      },
    ])('$scenario', ({ input, expected, expectedLabel }) => {
      const resolved = resolveCancelledBy(input);
      expect(resolved).toBe(expected);
      expect(resolveCancelledByLabel(resolved)).toBe(expectedLabel);
    });

    it('resolves role-specific SYSTEM 24h auto-cancel banner copy and allows opening history conversation even with zero messages', () => {
      const systemCancelled = makeReservation({
        cancelledBy: 'SYSTEM',
        messages: [],
      });
      const mentorCancelledEmpty = makeReservation({
        cancelledBy: 'MENTOR',
        messages: [],
      });
      const activeWithMessage = makeReservation({
        messages: [{ content: '嗨導師！', role: 'MENTEE' }],
      });

      expect(isReservationCancelled(systemCancelled)).toBe(true);
      expect(isSystemAutoCancelled(systemCancelled)).toBe(true);
      expect(isSystemAutoCancelled(mentorCancelledEmpty)).toBe(false);

      expect(resolveSystemAutoCancelNotice(systemCancelled, 'mentor')).toBe(
        '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      );
      expect(resolveSystemAutoCancelNotice(systemCancelled, 'mentee')).toBe(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      );
      expect(
        resolveSystemAutoCancelNotice(mentorCancelledEmpty, 'mentor')
      ).toBeNull();
      expect(
        resolveSystemAutoCancelNotice(activeWithMessage, 'mentee')
      ).toBeNull();

      expect(canOpenHistoryConversation(systemCancelled)).toBe(true);
      expect(canOpenHistoryConversation(mentorCancelledEmpty)).toBe(false);
      expect(canOpenHistoryConversation(activeWithMessage)).toBe(true);
    });
  });

  describe('partitionReservationTabSlices (upcoming !cancelledBy guard & history derivation)', () => {
    it('excludes SYSTEM and participant-cancelled reservations from both upcoming and pending, sorts active tabs by dtstart asc, and deduplicates history', () => {
      const upcomingLater = makeReservation({
        id: 'up-later',
        dtstart: NOW_S + 4 * HOUR,
      });
      const upcomingSooner = makeReservation({
        id: 'up-sooner',
        dtstart: NOW_S + HOUR,
      });
      const upcomingCancelledByMentor = makeReservation({
        id: 'up-cancelled-mentor',
        dtstart: NOW_S + 2 * HOUR,
        cancelledBy: 'MENTOR',
      });
      const pendingSystemCancelled = makeReservation({
        id: 'pend-cancelled-system',
        dtstart: NOW_S + 3 * HOUR,
        cancelledBy: 'SYSTEM',
      });
      const pendingActive = makeReservation({
        id: 'pend-active',
        dtstart: NOW_S + 5 * HOUR,
      });
      const existingHistory = makeReservation({
        id: 'hist-1',
        dtstart: NOW_S - DAY,
      });

      const partitioned = partitionReservationTabSlices({
        upcomingItems: [
          upcomingLater,
          upcomingCancelledByMentor,
          upcomingSooner,
        ],
        pendingItems: [pendingSystemCancelled, pendingActive],
        historyItems: [upcomingCancelledByMentor, existingHistory],
      });

      expect(partitioned.upcoming.map((it) => it.id)).toEqual([
        'up-sooner',
        'up-later',
      ]);
      expect(partitioned.pending.map((it) => it.id)).toEqual(['pend-active']);
      // `pend-cancelled-system` is prepended while `up-cancelled-mentor` is NOT duplicated
      expect(partitioned.history.map((it) => it.id)).toEqual([
        'pend-cancelled-system',
        'up-cancelled-mentor',
        'hist-1',
      ]);

      expect(
        filterActiveTabReservations([
          upcomingLater,
          upcomingCancelledByMentor,
          upcomingSooner,
        ]).map((it) => it.id)
      ).toEqual(['up-sooner', 'up-later']);
    });
  });

  describe('PLAYBOOK [DECISION-02] feedback eligibility, Plan A publish, COUNTERPART_ABSENT, and #731 permanent edit', () => {
    const publicRating: NonNullable<ReservationFeedback['rating']> = {
      rating: 10,
      content: '架構建議非常具體且實用！',
      createdAt: NOW_S,
      updatedAt: NOW_S,
      authorName: '王＊明',
      isPublic: true,
    };

    const unpublicizedRating: NonNullable<ReservationFeedback['rating']> = {
      ...publicRating,
      rating: 8,
      isPublic: false,
    };

    it.each<{
      name: string;
      reservation: Reservation;
      expectQueue: boolean;
      expectMenteeSubmit: boolean;
      expectMentorSubmit: boolean;
      expectMenteeEdit: boolean;
      expectMentorEdit: boolean;
      expectMentorPublicRatingVisible: boolean;
      expectMentorExpandable: boolean;
      expectMenteeNotHappened: boolean;
      expectMentorAttendance: ReturnType<typeof resolveMentorOwnAttendance>;
      expectMenteeInitialStep: ReturnType<typeof resolveFeedbackInitialStep>;
      expectMentorInitialStep: ReturnType<typeof resolveFeedbackInitialStep>;
    }>([
      {
        name: 'Initial ANSWER pending for both sides',
        reservation: makeReservation({
          feedback: {
            meetingHappened: null,
            rating: null,
            nextStep: 'ANSWER',
          },
        }),
        expectQueue: true,
        expectMenteeSubmit: true,
        expectMentorSubmit: true,
        expectMenteeEdit: false,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: false,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'pending',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'Mentee confirmed happened, resuming RATE step -> Mentee opens rating, Mentor never opens rating even when myMeetingHappened is undefined',
        reservation: makeReservation({
          feedback: {
            meetingHappened: true,
            rating: null,
            nextStep: 'RATE',
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: true,
        expectMentorSubmit: false,
        expectMenteeEdit: false,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: true,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'happened',
        expectMenteeInitialStep: 'rating',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'Plan A immediate publish: Mentee rated publicly while Mentor has NOT confirmed yet (nextStep: ANSWER)',
        reservation: makeReservation({
          feedback: {
            meetingHappened: null,
            myMeetingHappened: null,
            rating: publicRating,
            nextStep: 'ANSWER',
          },
        }),
        expectQueue: true,
        expectMenteeSubmit: true,
        expectMentorSubmit: true,
        expectMenteeEdit: false,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: true,
        expectMentorExpandable: false,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'pending',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'Plan A settled: Mentee rated publicly (nextStep: null) -> Mentee has #731 permanent edit, Mentor never edits',
        reservation: makeReservation({
          feedback: {
            meetingHappened: true,
            myMeetingHappened: true,
            rating: publicRating,
            nextStep: null,
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: false,
        expectMentorSubmit: false,
        expectMenteeEdit: true,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: true,
        expectMentorExpandable: true,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'happened',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'COUNTERPART_ABSENT / Mentor marked not-happened: rating becomes unpublicized, hidden from Mentor, but Mentee retains #731 permanent edit',
        reservation: makeReservation({
          feedback: {
            meetingHappened: false,
            myMeetingHappened: false,
            rating: unpublicizedRating,
            nextStep: null,
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: false,
        expectMentorSubmit: false,
        expectMenteeEdit: true,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: false,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'not-happened',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'COUNTERPART_ABSENT by Mentee while Mentor answered happened: Mentor still sees own 查看紀錄 without leaking unpublicized rating',
        reservation: makeReservation({
          feedback: {
            meetingHappened: false,
            myMeetingHappened: true,
            rating: unpublicizedRating,
            nextStep: null,
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: false,
        expectMentorSubmit: false,
        expectMenteeEdit: true,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: true,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'happened',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'Mentee reported not-happened without rating -> locked 未進行, no edit',
        reservation: makeReservation({
          feedback: {
            meetingHappened: false,
            myMeetingHappened: null,
            rating: null,
            nextStep: null,
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: false,
        expectMentorSubmit: false,
        expectMenteeEdit: false,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: false,
        expectMenteeNotHappened: true,
        expectMentorAttendance: 'unknown',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
      {
        name: 'SYSTEM 24h auto-cancelled reservation with stale nextStep=ANSWER -> strictly ineligible for all feedback actions',
        reservation: makeReservation({
          cancelledBy: 'SYSTEM',
          feedback: {
            meetingHappened: null,
            rating: publicRating,
            nextStep: 'ANSWER',
          },
        }),
        expectQueue: false,
        expectMenteeSubmit: false,
        expectMentorSubmit: false,
        expectMenteeEdit: false,
        expectMentorEdit: false,
        expectMentorPublicRatingVisible: false,
        expectMentorExpandable: false,
        expectMenteeNotHappened: false,
        expectMentorAttendance: 'unknown',
        expectMenteeInitialStep: 'attendance',
        expectMentorInitialStep: 'attendance',
      },
    ])(
      '$name',
      ({
        reservation,
        expectQueue,
        expectMenteeSubmit,
        expectMentorSubmit,
        expectMenteeEdit,
        expectMentorEdit,
        expectMentorPublicRatingVisible,
        expectMentorExpandable,
        expectMenteeNotHappened,
        expectMentorAttendance,
        expectMenteeInitialStep,
        expectMentorInitialStep,
      }) => {
        expect(isEligibleForPendingFeedbackQueue(reservation)).toBe(
          expectQueue
        );
        expect(canSubmitReservationFeedback(reservation, 'mentee')).toBe(
          expectMenteeSubmit
        );
        expect(canSubmitReservationFeedback(reservation, 'mentor')).toBe(
          expectMentorSubmit
        );
        expect(canEditReservationFeedback(reservation, 'mentee')).toBe(
          expectMenteeEdit
        );
        expect(canEditReservationFeedback(reservation, 'mentor')).toBe(
          expectMentorEdit
        );
        expect(isPublicRatingVisibleToMentor(reservation)).toBe(
          expectMentorPublicRatingVisible
        );
        expect(hasExpandableMentorFeedback(reservation)).toBe(
          expectMentorExpandable
        );
        expect(isMenteeSessionMarkedNotHappened(reservation)).toBe(
          expectMenteeNotHappened
        );
        expect(resolveMentorOwnAttendance(reservation)).toBe(
          expectMentorAttendance
        );
        expect(
          resolveFeedbackInitialStep({ reservation, role: 'mentee' })
        ).toBe(expectMenteeInitialStep);
        expect(
          resolveFeedbackInitialStep({ reservation, role: 'mentor' })
        ).toBe(expectMentorInitialStep);
      }
    );

    it('resolves dialog step & effective role safely (clamping accidental rating step for mentors while honoring edit mode)', () => {
      const mentorReservation = makeReservation({
        viewerRole: 'MENTOR',
        feedback: {
          meetingHappened: true,
          rating: null,
          nextStep: 'RATE',
        },
      });

      expect(
        resolveEffectiveFeedbackRole({ reservation: mentorReservation })
      ).toBe('mentor');
      expect(
        resolveEffectiveFeedbackRole({
          reservation: mentorReservation,
          isEditMode: true,
        })
      ).toBe('mentee');

      expect(
        resolveFeedbackDialogStep({
          reservation: mentorReservation,
          role: 'mentor',
          mode: 'create',
          requestedStep: 'rating',
        })
      ).toBe('attendance');

      expect(
        resolveFeedbackDialogStep({
          reservation: mentorReservation,
          role: 'mentor',
          mode: 'create',
          requestedStep: 'not-happened',
        })
      ).toBe('not-happened');

      expect(
        resolveFeedbackDialogStep({
          reservation: mentorReservation,
          role: 'mentee',
          mode: 'edit',
        })
      ).toBe('rating');
    });
  });

  describe('deep-link guard suppression via extractDeepLinkReservationId', () => {
    it.each([
      { query: 'feedback=501', expectedSuppressed: true },
      { query: 'tab=history&feedback=881', expectedSuppressed: true },
      { query: 'reservationId=101', expectedSuppressed: true },
      { query: 'reservation_id=102', expectedSuppressed: true },
      { query: 'feedbackReservationId=103', expectedSuppressed: true },
      { query: 'feedback=queue', expectedSuppressed: true },
      { query: 'feedback=1', expectedSuppressed: false },
      { query: 'feedback=0', expectedSuppressed: false },
      { query: 'feedback=open', expectedSuppressed: false },
      { query: '', expectedSuppressed: false },
    ])(
      'pathname="/mentor-pool?$query" -> suppressed=$expectedSuppressed',
      ({ query, expectedSuppressed }) => {
        expect(
          shouldSuppressPendingFeedbackPopup({
            pathname: '/mentor-pool',
            searchParams: new URLSearchParams(query),
          })
        ).toBe(expectedSuppressed);
      }
    );
  });
});

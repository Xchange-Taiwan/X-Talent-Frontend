import fs from 'node:fs';
import path from 'node:path';

import { fromPartial } from '@total-typescript/shoehorn';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  buildReservationFixture,
  classifyReservationMessages,
  extractRawPendingFeedbackList,
  formatDateTime,
  formatExperience,
  formatPendingFeedbackDateTime,
  isReservationMessagesProjected,
  isReservationViewerProjected,
  mapPendingFeedbackCandidate,
  mapToReservation,
  normalizeReservationViewerRole,
  projectPendingFeedbackList,
  projectReservation,
  type ReservationInfoVOWithVersion,
  resolveCounterpartyId,
  resolveCounterpartyProfile,
  resolveFeedbackViewerRole,
  resolveReservationMessages,
  resolveReservationViewer,
  resolveTargetMentorId,
  sortPendingFeedbackOldestFirst,
} from '@/lib/reservation/reservationProjection';
import type { Reservation } from '@/types/reservation';
import type { RawPendingFeedbackItem } from '@/types/reservationFeedback';

const DTSTART = 1704099600;
const DTEND = 1704103200;

function makeReservationDto(
  overrides: Partial<ReservationInfoVOWithVersion> = {}
): ReservationInfoVOWithVersion {
  return fromPartial<ReservationInfoVOWithVersion>({
    id: 42,
    sender: {
      user_id: 10,
      role: 'MENTEE',
      status: 'PENDING',
      name: 'Bob Mentee',
      avatar: 'https://cdn.example.com/bob.png',
      job_title: 'Product Designer',
      years_of_experience: 'ONE_TO_THREE',
    },
    participant: {
      user_id: 20,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Alice Mentor',
      avatar: 'https://cdn.example.com/alice.png',
      job_title: 'Staff Engineer',
      years_of_experience: 'FIVE_TO_TEN',
    },
    schedule_id: 77,
    dtstart: DTSTART,
    dtend: DTEND,
    previous_reserve: null,
    messages: [],
    ...overrides,
  });
}

describe('reservationProjection architectural purity (#932)', () => {
  it('contains zero React, Next, hook, component, or service I/O imports', () => {
    const sourcePath = path.resolve(
      process.cwd(),
      'src/lib/reservation/reservationProjection.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*(import|export)\b/.test(line));

    for (const line of importLines) {
      expect(line).not.toMatch(/from\s+['"]react/);
      expect(line).not.toMatch(/from\s+['"]next/);
      expect(line).not.toMatch(/from\s+['"]@\/hooks\//);
      expect(line).not.toMatch(/from\s+['"]@\/components\//);
      expect(line).not.toMatch(/from\s+['"]@\/services\//);
      expect(line).not.toMatch(/apiClient/);
    }
  });
});

describe('reservationProjection formatting helpers (#932)', () => {
  it('formats standard reservation date/time and pending-feedback date/time with invalid dtend fallback', () => {
    expect(formatExperience('THREE_TO_FIVE')).toBe('3~5 年');
    expect(formatExperience('UNKNOWN')).toBe('');

    expect(formatDateTime(DTSTART, DTEND)).toEqual({
      date: dayjs.unix(DTSTART).format('ddd, MMM DD, YYYY'),
      time: `${dayjs.unix(DTSTART).format('h:mm a')} – ${dayjs.unix(DTEND).format('h:mm a')}`,
    });

    expect(formatPendingFeedbackDateTime(DTSTART, DTEND)).toEqual({
      date: dayjs.unix(DTSTART).format('YYYY/MM/DD'),
      time: `${dayjs.unix(DTSTART).format('HH:mm')}–${dayjs.unix(DTEND).format('HH:mm')}`,
    });

    expect(formatPendingFeedbackDateTime(DTSTART, 0)).toEqual({
      date: dayjs.unix(DTSTART).format('YYYY/MM/DD'),
      time: `${dayjs.unix(DTSTART).format('HH:mm')}–${dayjs.unix(DTSTART).format('HH:mm')}`,
    });
  });
});

describe('mapToReservation pre-projected viewer, counterparty & cancellation fields (#932)', () => {
  it('pre-projects counterpartyUserId, profileHref, normalizedViewerRole, and targetMentorId for mentee and mentor viewers', () => {
    const dto = makeReservationDto({
      messages: [
        { user_id: 10, role: 'MENTEE', content: '請問系統設計如何準備？' },
        { user_id: 20, role: 'MENTOR', content: '可以先準備一個實際專案。' },
      ],
    });

    const asMentee = projectReservation(dto, '10');
    expect(projectReservation).toBe(mapToReservation);
    expect(asMentee).toMatchObject({
      id: '42',
      name: 'Alice Mentor',
      roleLine: 'Staff Engineer, 5~10 年',
      viewerRole: 'MENTEE',
      normalizedViewerRole: 'mentee',
      counterpartyUserId: '20',
      profileHref: '/profile/20',
      targetMentorId: '20',
      menteeMessage: { content: '請問系統設計如何準備？', role: 'MENTEE' },
      mentorMessage: { content: '可以先準備一個實際專案。', role: 'MENTOR' },
    });
    expect(asMentee.cancelledBy).toBeUndefined();
    expect(asMentee.cancelledByLabel).toBeUndefined();
    expect(isReservationViewerProjected(asMentee, '10')).toBe(true);
    expect(isReservationMessagesProjected(asMentee)).toBe(true);

    const asMentor = mapToReservation(dto, 20);
    expect(asMentor).toMatchObject({
      id: '42',
      name: 'Bob Mentee',
      roleLine: 'Product Designer, 1~3 年',
      viewerRole: 'MENTOR',
      normalizedViewerRole: 'mentor',
      counterpartyUserId: '10',
      profileHref: '/profile/10',
      targetMentorId: '20',
    });
    expect(isReservationViewerProjected(asMentor, 20)).toBe(true);
  });

  it('enforces self-profile profileHref guard (undefined when counterparty equals myUserId or myUserId is absent)', () => {
    const selfDto = makeReservationDto({
      sender: {
        user_id: 10,
        role: 'MENTEE',
        status: 'PENDING',
        name: 'Same User',
        avatar: '',
        job_title: 'Engineer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: 10,
        role: 'MENTOR',
        status: 'ACCEPT',
        name: 'Same User',
        avatar: '',
        job_title: 'Engineer',
        years_of_experience: 'ONE_TO_THREE',
      },
    });

    const selfMapped = mapToReservation(selfDto, '10');
    expect(selfMapped.counterpartyUserId).toBe('10');
    expect(selfMapped.profileHref).toBeUndefined();
    expect(selfMapped.normalizedViewerRole).toBe('mentee');
    expect(isReservationViewerProjected(selfMapped, '10')).toBe(true);

    const anonymousMapped = mapToReservation(makeReservationDto());
    expect(anonymousMapped.viewerRole).toBeUndefined();
    expect(anonymousMapped.normalizedViewerRole).toBeUndefined();
    expect(anonymousMapped.counterpartyUserId).toBeUndefined();
    expect(anonymousMapped.profileHref).toBeUndefined();
  });

  it('strictly preserves participant (other side) precedence on cancelledBy and cancelledByLabel when both sides are REJECT', () => {
    const bothRejectDto = makeReservationDto({
      sender: {
        user_id: 10,
        role: 'MENTEE',
        status: 'REJECT',
        name: 'Bob Mentee',
        avatar: '',
        job_title: 'Designer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: 20,
        role: 'MENTOR',
        status: 'REJECT',
        name: 'Alice Mentor',
        avatar: '',
        job_title: 'Engineer',
        years_of_experience: 'FIVE_TO_TEN',
      },
    });

    // Viewed by sender (MENTEE, 10) -> other side is participant (MENTOR, 20)
    const viewedByMentee = mapToReservation(bothRejectDto, 10);
    expect(viewedByMentee.cancelledBy).toBe('MENTOR');
    expect(viewedByMentee.cancelledByLabel).toBe('已由導師取消');

    // Viewed by participant (MENTOR, 20) -> other side is sender (MENTEE, 10)
    const viewedByMentor = mapToReservation(bothRejectDto, 20);
    expect(viewedByMentor.cancelledBy).toBe('MENTEE');
    expect(viewedByMentor.cancelledByLabel).toBe('已由學員取消');

    // Viewed without myUserId -> defaults counterparty to participant (MENTOR)
    const viewedAnonymously = mapToReservation(bothRejectDto);
    expect(viewedAnonymously.cancelledBy).toBe('MENTOR');
    expect(viewedAnonymously.cancelledByLabel).toBe('已由導師取消');

    // Explicit SYSTEM auto-cancel always wins over participant status flags
    const systemCancelled = mapToReservation(
      makeReservationDto({
        ...bothRejectDto,
        cancelled_by: 'SYSTEM',
      }),
      10
    );
    expect(systemCancelled.cancelledBy).toBe('SYSTEM');
    expect(systemCancelled.cancelledByLabel).toBe('已自動取消');
  });

  it('pre-projects cancelReasonMessage separately from menteeMessage / mentorMessage on cancelled DTOs', () => {
    const cancelledByMenteeDto = makeReservationDto({
      sender: {
        user_id: 10,
        role: 'MENTEE',
        status: 'REJECT',
        name: 'Bob Mentee',
        avatar: '',
        job_title: 'Designer',
        years_of_experience: 'ONE_TO_THREE',
      },
      messages: [
        { user_id: 10, role: 'MENTEE', content: '初始預約提問' },
        { user_id: 20, role: 'MENTOR', content: '導師確認回覆' },
        { user_id: 10, role: 'MENTEE', content: '臨時加班需取消' },
      ],
    });

    const projected = mapToReservation(cancelledByMenteeDto, 20);
    expect(projected.cancelledBy).toBe('MENTEE');
    expect(projected.cancelledByLabel).toBe('已由學員取消');
    expect(projected.menteeMessage).toEqual({
      content: '初始預約提問',
      role: 'MENTEE',
    });
    expect(projected.mentorMessage).toEqual({
      content: '導師確認回覆',
      role: 'MENTOR',
    });
    expect(projected.cancelReasonMessage).toEqual({
      content: '臨時加班需取消',
      role: 'MENTEE',
      isCancelReason: true,
    });
    expect(isReservationMessagesProjected(projected)).toBe(true);
  });
});

describe('pending feedback extraction, candidate projection & sorting (#932)', () => {
  it('extracts raw pending feedback lists across array, reservations, and items envelopes', () => {
    const item = fromPartial<RawPendingFeedbackItem>({ id: 1 });
    expect(extractRawPendingFeedbackList(null)).toEqual([]);
    expect(extractRawPendingFeedbackList(undefined)).toEqual([]);
    expect(extractRawPendingFeedbackList([makeReservationDto()])).toHaveLength(
      1
    );
    expect(extractRawPendingFeedbackList({ reservations: [item] })).toEqual([
      item,
    ]);
    expect(extractRawPendingFeedbackList({ items: [item] })).toEqual([item]);
  });

  it('projects simplified and full pending-feedback candidates with pre-projected viewer fields and filters ineligible items', () => {
    const simplified = mapPendingFeedbackCandidate(
      fromPartial<RawPendingFeedbackItem>({
        id: 501,
        dtstart: DTSTART,
        dtend: DTEND,
        counterparty: {
          user_id: 88,
          name: 'Emily Chen',
          avatar: '   ',
          job_title: 'UX Designer',
          years_of_experience: 'THREE_TO_FIVE',
        },
      }),
      '1',
      'MENTOR'
    );

    expect(simplified).toMatchObject({
      id: '501',
      name: 'Emily Chen',
      avatar: undefined,
      roleLine: 'UX Designer, 3~5 年',
      viewerRole: 'MENTOR',
      normalizedViewerRole: 'mentor',
      counterpartyUserId: '88',
      profileHref: '/profile/88',
      targetMentorId: '1',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const cancelledCandidate = mapPendingFeedbackCandidate(
      fromPartial<RawPendingFeedbackItem>({
        id: 502,
        cancelled_by: 'SYSTEM',
      }),
      '1'
    );
    expect(cancelledCandidate).toBeNull();

    // Full ReservationInfoVO DTO with fallbackViewerRole fallback, YYYY/MM/DD date format,
    // pre-projected viewer fields, completed-feedback filtering, and list deduplication/sorting
    const fullDtoMissingRole = makeReservationDto({
      id: 601,
      dtstart: DTSTART + 3600,
      dtend: DTEND + 3600,
      sender: {
        user_id: 10,
        role: '' as unknown as 'MENTEE',
        status: 'ACCEPT',
        name: 'Bob Mentee',
        avatar: '  https://cdn.example.com/bob.png  ',
        job_title: 'Product Designer',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: 20,
        role: 'MENTOR',
        status: 'ACCEPT',
        name: 'Alice Mentor',
        avatar: '  https://cdn.example.com/alice.png  ',
        job_title: 'Staff Engineer',
        years_of_experience: 'FIVE_TO_TEN',
      },
    });

    const fullProjected = mapPendingFeedbackCandidate(
      fullDtoMissingRole,
      '10',
      'MENTEE'
    );
    expect(fullProjected).toMatchObject({
      id: '601',
      name: 'Alice Mentor',
      avatar: 'https://cdn.example.com/alice.png',
      date: dayjs.unix(DTSTART + 3600).format('YYYY/MM/DD'),
      time: `${dayjs.unix(DTSTART + 3600).format('HH:mm')}–${dayjs.unix(DTEND + 3600).format('HH:mm')}`,
      viewerRole: 'MENTEE',
      normalizedViewerRole: 'mentee',
      counterpartyUserId: '20',
      profileHref: '/profile/20',
      targetMentorId: '20',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const completedFullDto = makeReservationDto({
      id: 602,
      feedback: {
        meeting_happened: true,
        rating: null,
        next_step: null,
      },
    });
    expect(mapPendingFeedbackCandidate(completedFullDto, '10')).toBeNull();

    const earlierFullDto = makeReservationDto({
      id: 600,
      dtstart: DTSTART,
      dtend: DTEND,
    });

    const projectedQueue = projectPendingFeedbackList(
      {
        reservations: [
          fullDtoMissingRole,
          fullDtoMissingRole,
          completedFullDto,
          makeReservationDto({ id: 603, cancelled_by: 'MENTOR' }),
          earlierFullDto,
        ],
      },
      '10',
      'MENTEE'
    );
    expect(projectedQueue.map((item) => item.id)).toEqual(['600', '601']);
    expect(projectedQueue[0]).toMatchObject({
      id: '600',
      date: dayjs.unix(DTSTART).format('YYYY/MM/DD'),
      normalizedViewerRole: 'mentee',
      profileHref: '/profile/20',
      targetMentorId: '20',
    });
    expect(
      projectPendingFeedbackList({ reservations: [earlierFullDto] }, '')
    ).toEqual([]);
  });

  it('sorts pending feedback reservations oldest-first by dtend, then dtstart, then numeric id without mutating input', () => {
    const items: Reservation[] = [
      buildReservationFixture({ id: '12', dtstart: 100, dtend: 300 }),
      buildReservationFixture({ id: '2', dtstart: 100, dtend: 200 }),
      buildReservationFixture({ id: '10', dtstart: 100, dtend: 200 }),
      buildReservationFixture({ id: '5', dtstart: 50, dtend: 200 }),
    ];

    const sorted = sortPendingFeedbackOldestFirst(items);
    expect(sorted.map((it) => it.id)).toEqual(['5', '2', '10', '12']);
    expect(items.map((it) => it.id)).toEqual(['12', '2', '10', '5']);
  });
});

describe('counterparty, viewer, message helpers & buildReservationFixture (#932)', () => {
  it('supports counterparty ID, target mentor ID, and role normalization helpers', () => {
    const pair = { senderUserId: '10', participantUserId: '20' };
    expect(resolveCounterpartyId(pair, '10')).toBe('20');
    expect(resolveCounterpartyId(pair, '20')).toBe('10');
    expect(resolveTargetMentorId(pair, '10', 'mentee')).toBe(20);
    expect(resolveTargetMentorId(pair, '20', 'mentor')).toBe(20);
    expect(resolveFeedbackViewerRole('MENTOR', false)).toBe('mentor');
    expect(resolveFeedbackViewerRole(undefined, true)).toBe('mentor');
    expect(
      normalizeReservationViewerRole({ id: '1', viewerRole: undefined }, true)
    ).toEqual({ id: '1', viewerRole: 'MENTOR' });
    expect(resolveCounterpartyProfile(makeReservationDto(), 10).name).toBe(
      'Alice Mentor'
    );
  });

  it('builds pre-projected fixtures via buildReservationFixture and detects unprojected raw overrides accurately', () => {
    const projectedFixture = buildReservationFixture({
      id: 'res-fixture-932',
      senderUserId: 'mentee-1',
      participantUserId: 'mentor-2',
      viewerRole: 'MENTEE',
      myUserId: 'mentee-1',
      cancelledBy: 'MENTOR',
      messages: [
        { content: '學員預約提問', role: 'MENTEE' },
        { content: '導師臨時有事取消', role: 'MENTOR' },
      ],
    });

    expect(projectedFixture).toMatchObject({
      id: 'res-fixture-932',
      normalizedViewerRole: 'mentee',
      counterpartyUserId: 'mentor-2',
      profileHref: '/profile/mentor-2',
      targetMentorId: 'mentor-2',
      cancelledBy: 'MENTOR',
      cancelledByLabel: '已由導師取消',
      menteeMessage: { content: '學員預約提問', role: 'MENTEE' },
      cancelReasonMessage: {
        content: '導師臨時有事取消',
        role: 'MENTOR',
        isCancelReason: true,
      },
    });
    expect(projectedFixture.mentorMessage).toBeUndefined();
    expect(isReservationViewerProjected(projectedFixture, 'mentee-1')).toBe(
      true
    );
    expect(isReservationViewerProjected(projectedFixture, 'mentor-2')).toBe(
      false
    );
    expect(isReservationViewerProjected(projectedFixture, 'user-admin')).toBe(
      false
    );
    expect(isReservationMessagesProjected(projectedFixture)).toBe(true);

    // Fixture built with viewerRole but WITHOUT myUserId leaves profileHref undefined;
    // must NOT false-positive as viewer-projected when later viewed by a real user.
    const fixtureWithoutMyUserId = buildReservationFixture({
      id: 'res-no-viewer-id',
      senderUserId: 'user-123',
      participantUserId: 'user-456',
      viewerRole: 'MENTEE',
    });
    expect(fixtureWithoutMyUserId.normalizedViewerRole).toBe('mentee');
    expect(fixtureWithoutMyUserId.profileHref).toBeUndefined();
    expect(
      isReservationViewerProjected(fixtureWithoutMyUserId, 'user-123')
    ).toBe(false);

    // Pre-projected for '10' (/profile/20) must return false when viewed by third-party 'user-admin' (/profile/10)
    // or when myUserId is empty/undefined/null while profileHref is populated
    const projectedFor10 = mapToReservation(makeReservationDto(), '10');
    expect(projectedFor10.profileHref).toBe('/profile/20');
    expect(isReservationViewerProjected(projectedFor10, 'user-admin')).toBe(
      false
    );
    expect(isReservationViewerProjected(projectedFor10, undefined)).toBe(false);
    expect(isReservationViewerProjected(projectedFor10, null)).toBe(false);
    expect(isReservationViewerProjected(projectedFor10, '')).toBe(false);

    // Explicit cancelReasonMessage matching an untagged thread entry splits it via didSplitExplicitFromThread
    // and recomputes menteeMessage / mentorMessage from the remaining non-cancel thread messages
    const explicitCancelFromUntaggedThread = resolveReservationMessages({
      cancelledBy: 'SYSTEM',
      messages: [
        { content: '初始預約提問 Q1', role: 'MENTEE' },
        { content: '導師回覆 A1', role: 'MENTOR' },
        { content: '系統備註取消原因 S1', role: 'MENTEE' },
      ],
      menteeMessage: { content: '系統備註取消原因 S1', role: 'MENTEE' },
      cancelReasonMessage: { content: '系統備註取消原因 S1', role: 'MENTEE' },
    });
    expect(explicitCancelFromUntaggedThread).toEqual({
      messages: [
        { content: '初始預約提問 Q1', role: 'MENTEE' },
        { content: '導師回覆 A1', role: 'MENTOR' },
        {
          content: '系統備註取消原因 S1',
          role: 'MENTEE',
          isCancelReason: true,
        },
      ],
      menteeMessage: { content: '初始預約提問 Q1', role: 'MENTEE' },
      mentorMessage: { content: '導師回覆 A1', role: 'MENTOR' },
      cancelReasonMessage: {
        content: '系統備註取消原因 S1',
        role: 'MENTEE',
        isCancelReason: true,
      },
    });

    // Mismatched cancelledBy / cancelledByLabel presence must return false in both profileHref and self-guard branches
    expect(
      isReservationViewerProjected(
        { ...projectedFor10, cancelledByLabel: '已由導師取消' },
        '10'
      )
    ).toBe(false);
    const selfProjected = buildReservationFixture({
      senderUserId: 'user-123',
      participantUserId: 'user-123',
      viewerRole: 'MENTEE',
      myUserId: 'user-123',
    });
    expect(isReservationViewerProjected(selfProjected, 'user-123')).toBe(true);
    expect(
      isReservationViewerProjected(
        { ...selfProjected, cancelledByLabel: '已自動取消' },
        'user-123'
      )
    ).toBe(false);

    const rawUnprojected = fromPartial<Reservation>({
      id: 'raw-1',
      senderUserId: 'mentee-1',
      participantUserId: 'mentor-2',
      cancelledBy: 'MENTEE',
      messages: [
        { content: 'Q1', role: 'MENTEE' },
        { content: 'C1', role: 'MENTEE' },
      ],
      menteeMessage: { content: 'C1', role: 'MENTEE' },
    });

    expect(isReservationViewerProjected(rawUnprojected, 'mentee-1')).toBe(
      false
    );
    expect(isReservationMessagesProjected(rawUnprojected)).toBe(false);
    expect(
      resolveReservationViewer({
        reservation: rawUnprojected,
        myUserId: 'mentee-1',
      })
    ).toEqual({
      viewerRole: undefined,
      profileHref: '/profile/mentor-2',
      cancelledByLabel: '已由學員取消',
    });
    expect(
      classifyReservationMessages(rawUnprojected.messages, 'MENTEE')
        .cancelReasonMessage?.content
    ).toBe('C1');
    expect(
      resolveReservationMessages(rawUnprojected).menteeMessage?.content
    ).toBe('Q1');

    // Raw cancelled fixtures (cancelledByLabel === undefined) supplying messages + cancelReasonMessage
    // while omitting menteeMessage or mentorMessage must return false so previews resolve omitted party messages.
    const rawMissingMentorMessage = fromPartial<Reservation>({
      id: 'raw-missing-mentor',
      cancelledBy: 'MENTEE',
      messages: [
        { content: '初始預約提問 Q1', role: 'MENTEE' },
        { content: '導師先前確認回覆 A1', role: 'MENTOR' },
        { content: '學員取消原因 C1', role: 'MENTEE', isCancelReason: true },
      ],
      menteeMessage: { content: '初始預約提問 Q1', role: 'MENTEE' },
      cancelReasonMessage: {
        content: '學員取消原因 C1',
        role: 'MENTEE',
        isCancelReason: true,
      },
    });
    expect(isReservationMessagesProjected(rawMissingMentorMessage)).toBe(false);

    const rawMissingMenteeMessage = fromPartial<Reservation>({
      id: 'raw-missing-mentee',
      cancelledBy: 'MENTOR',
      messages: [
        { content: '初始預約提問 Q1', role: 'MENTEE' },
        { content: '導師取消原因 R1', role: 'MENTOR', isCancelReason: true },
      ],
      cancelReasonMessage: {
        content: '導師取消原因 R1',
        role: 'MENTOR',
        isCancelReason: true,
      },
    });
    expect(isReservationMessagesProjected(rawMissingMenteeMessage)).toBe(false);

    const rawCompleteCancelled = fromPartial<Reservation>({
      id: 'raw-complete-cancelled',
      cancelledBy: 'MENTEE',
      messages: [
        { content: '初始預約提問 Q1', role: 'MENTEE' },
        { content: '導師先前確認回覆 A1', role: 'MENTOR' },
        { content: '學員取消原因 C1', role: 'MENTEE', isCancelReason: true },
      ],
      menteeMessage: { content: '初始預約提問 Q1', role: 'MENTEE' },
      mentorMessage: { content: '導師先前確認回覆 A1', role: 'MENTOR' },
      cancelReasonMessage: {
        content: '學員取消原因 C1',
        role: 'MENTEE',
        isCancelReason: true,
      },
    });
    expect(isReservationMessagesProjected(rawCompleteCancelled)).toBe(true);
  });
});

// Merged from the deleted #932 forwarding-module test (reservationViewerModel.test.ts, #977).
function makeViewerReservation(
  overrides: Partial<Reservation> = {}
): Reservation {
  return {
    id: 'res-1',
    name: 'Counterparty Name',
    roleLine: 'Designer',
    date: '2026-07-26',
    time: '11:00 AM – 11:30 AM',
    messages: [],
    scheduleId: 1,
    dtstart: 0,
    dtend: 0,
    version: 0,
    senderUserId: 'user-sender',
    participantUserId: 'user-participant',
    ...overrides,
  };
}

describe('resolveReservationViewer - profileHref counterparty resolution', () => {
  it('resolves profileHref to participant when the viewer is the sender', () => {
    const reservation = makeViewerReservation({
      senderUserId: 'user-123',
      participantUserId: 'user-456',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-123',
    });
    expect(profileHref).toBe('/profile/user-456');
  });

  it('resolves profileHref to sender when the viewer is the participant', () => {
    const reservation = makeViewerReservation({
      senderUserId: 'user-123',
      participantUserId: 'user-456',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-456',
    });
    expect(profileHref).toBe('/profile/user-123');
  });

  it('resolves profileHref to sender (fallback) when myUserId matches neither side', () => {
    const reservation = makeViewerReservation({
      senderUserId: 'user-123',
      participantUserId: 'user-456',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-admin',
    });
    expect(profileHref).toBe('/profile/user-123');
  });

  it('resolves profileHref to undefined when myUserId is not provided', () => {
    const reservation = makeViewerReservation();
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: undefined,
    });
    expect(profileHref).toBeUndefined();
  });

  it('resolves profileHref to undefined when myUserId is an empty string', () => {
    const reservation = makeViewerReservation();
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: '',
    });
    expect(profileHref).toBeUndefined();
  });

  it('resolves correctly when senderUserId is missing/empty (prevent crash fallback)', () => {
    const reservation = makeViewerReservation({
      senderUserId: '',
      participantUserId: 'user-456',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-456',
    });
    expect(profileHref).toBeUndefined();
  });

  it('resolves correctly when participantUserId is missing/empty (prevent crash fallback)', () => {
    const reservation = makeViewerReservation({
      senderUserId: 'user-123',
      participantUserId: '',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-123',
    });
    expect(profileHref).toBeUndefined();
  });
});

describe('resolveReservationViewer - self guard', () => {
  it('returns undefined profileHref when the resolved counterparty would be the viewer themself', () => {
    const reservation = makeViewerReservation({
      senderUserId: 'user-123',
      participantUserId: 'user-123',
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: 'user-123',
    });
    expect(profileHref).toBeUndefined();
  });

  it('compares ids across number/string types', () => {
    const reservation = makeViewerReservation({
      senderUserId: 123,
      participantUserId: 123,
    });
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: '123',
    });
    expect(profileHref).toBeUndefined();
  });
});

describe('resolveReservationViewer - viewerRole', () => {
  it('derives mentor from Reservation.viewerRole', () => {
    const reservation = makeViewerReservation({ viewerRole: 'MENTOR' });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBe('mentor');
  });

  it('derives mentee from Reservation.viewerRole', () => {
    const reservation = makeViewerReservation({ viewerRole: 'MENTEE' });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBe('mentee');
  });

  it('is undefined when the reservation carries no role data', () => {
    const reservation = makeViewerReservation({ viewerRole: undefined });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBeUndefined();
  });
});

describe('resolveReservationViewer - cancelledByLabel', () => {
  it('is undefined when the reservation was not cancelled', () => {
    const reservation = makeViewerReservation({ cancelledBy: undefined });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBeUndefined();
  });

  it('renders the mentor-cancelled label', () => {
    const reservation = makeViewerReservation({ cancelledBy: 'MENTOR' });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBe('已由導師取消');
  });

  it('renders the mentee-cancelled label', () => {
    const reservation = makeViewerReservation({ cancelledBy: 'MENTEE' });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBe('已由學員取消');
  });

  it('renders the system auto-cancelled label', () => {
    const reservation = makeViewerReservation({ cancelledBy: 'SYSTEM' });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBe('已自動取消');
  });
});

describe('resolveReservationViewer - null reservation', () => {
  it('returns undefined/inert fields when reservation is null, e.g. before a dialog resolves its data', () => {
    const model = resolveReservationViewer({
      reservation: null,
      myUserId: 'user-sender',
    });

    expect(model.viewerRole).toBeUndefined();
    expect(model.profileHref).toBeUndefined();
    expect(model.cancelledByLabel).toBeUndefined();
  });
});

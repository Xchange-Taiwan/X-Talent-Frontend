import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import {
  formatExperience,
  resolveCounterpartyProfile,
} from '@/lib/reservation/resolveCounterparty';
import { formatDateTime, mapToReservation } from '@/services/reservations';
import { components } from '@/types/api';

type ReservationInfoVO = components['schemas']['ReservationInfoVO'];

// 2024-01-01 09:00:00 UTC (epoch seconds)
const DTSTART = 1704099600;
// 2024-01-01 10:00:00 UTC (epoch seconds)
const DTEND = 1704103200;

function makeReservation(
  overrides: Partial<ReservationInfoVO> = {}
): ReservationInfoVO {
  return {
    id: 1,
    sender: {
      user_id: 10,
      role: 'MENTOR',
      status: 'ACCEPT',
      name: 'Alice',
      avatar: '',
      job_title: 'Engineer',
      years_of_experience: 'THREE_TO_FIVE',
    },
    participant: {
      user_id: 20,
      role: 'MENTEE',
      status: 'PENDING',
      name: 'Bob',
      avatar: '',
      job_title: 'Designer',
      years_of_experience: 'ONE_TO_THREE',
    },
    schedule_id: 1,
    dtstart: DTSTART,
    dtend: DTEND,
    previous_reserve: null,
    messages: [],
    ...overrides,
  };
}

/* ================================
 * formatExperience
 * ================================ */

describe('formatExperience', () => {
  it('valid TotalWorkSpanEnum key → returns mapped string', () => {
    expect(formatExperience('THREE_TO_FIVE')).toBe('3~5 年');
  });

  it('unknown/invalid key → returns empty string', () => {
    expect(formatExperience('NOT_A_VALID_KEY')).toBe('');
  });
});

/* ================================
 * formatDateTime
 * ================================ */

describe('formatDateTime', () => {
  it('epoch seconds → returns correctly formatted date and time', () => {
    expect(formatDateTime(DTSTART, DTEND)).toEqual({
      date: 'Mon, Jan 01, 2024',
      time: '9:00 am – 10:00 am',
    });
  });
});

/* ================================
 * mapToReservation
 * ================================ */

describe('mapToReservation', () => {
  it('mentee message present, mentor silent → menteeMessage set, mentorMessage undefined', () => {
    const reservation = makeReservation({
      messages: [{ user_id: 20, role: 'MENTEE', content: 'Hello mentor!' }],
    });
    const result = mapToReservation(reservation);
    expect(result.menteeMessage).toEqual({
      content: 'Hello mentor!',
      role: 'MENTEE',
    });
    expect(result.mentorMessage).toBeUndefined();
    expect(result.messages).toEqual([
      { content: 'Hello mentor!', role: 'MENTEE' },
    ]);
  });

  it('both sides have messages → menteeMessage and mentorMessage both populated', () => {
    const reservation = makeReservation({
      sender: {
        user_id: 30,
        role: 'MENTEE',
        status: 'PENDING',
        name: 'Carol',
        avatar: '',
        job_title: 'PM',
        years_of_experience: 'ONE_TO_THREE',
      },
      participant: {
        user_id: 40,
        role: 'MENTOR',
        status: 'ACCEPT',
        name: 'Dave',
        avatar: '',
        job_title: 'Engineer',
        years_of_experience: 'THREE_TO_FIVE',
      },
      messages: [
        { user_id: 30, role: 'MENTEE', content: 'Looking forward!' },
        { user_id: 40, role: 'MENTOR', content: 'See you on Google Meet.' },
      ],
    });
    const result = mapToReservation(reservation);
    expect(result.menteeMessage).toEqual({
      content: 'Looking forward!',
      role: 'MENTEE',
    });
    expect(result.mentorMessage).toEqual({
      content: 'See you on Google Meet.',
      role: 'MENTOR',
    });
    expect(result.messages).toEqual([
      { content: 'Looking forward!', role: 'MENTEE' },
      { content: 'See you on Google Meet.', role: 'MENTOR' },
    ]);
  });

  it('multiple mentee messages → menteeMessage uses the latest, but messages keeps every entry in API order', () => {
    const reservation = makeReservation({
      messages: [
        { user_id: 20, role: 'MENTEE', content: 'First note' },
        { user_id: 20, role: 'MENTEE', content: 'Updated note' },
      ],
    });
    const result = mapToReservation(reservation);
    expect(result.menteeMessage).toEqual({
      content: 'Updated note',
      role: 'MENTEE',
    });
    expect(result.mentorMessage).toBeUndefined();
    expect(result.messages).toEqual([
      { content: 'First note', role: 'MENTEE' },
      { content: 'Updated note', role: 'MENTEE' },
    ]);
  });

  it('multi-turn conversation → messages preserves every turn in order', () => {
    const reservation = makeReservation({
      messages: [
        { user_id: 20, role: 'MENTEE', content: 'Initial question' },
        { user_id: 10, role: 'MENTOR', content: 'First reply' },
        { user_id: 20, role: 'MENTEE', content: 'Follow-up question' },
        { user_id: 10, role: 'MENTOR', content: 'Final reply' },
      ],
    });
    const result = mapToReservation(reservation);
    expect(result.messages.map((m) => m.content)).toEqual([
      'Initial question',
      'First reply',
      'Follow-up question',
      'Final reply',
    ]);
    expect(result.menteeMessage?.content).toBe('Follow-up question');
    expect(result.mentorMessage?.content).toBe('Final reply');
  });

  it('blank message content → message is undefined and messages array is empty', () => {
    const reservation = makeReservation({
      messages: [{ user_id: 20, role: 'MENTEE', content: '   ' }],
    });
    const result = mapToReservation(reservation);
    expect(result.menteeMessage).toBeUndefined();
    expect(result.mentorMessage).toBeUndefined();
    expect(result.messages).toEqual([]);
  });

  it('message role missing → falls back to user_id → sender/participant role lookup', () => {
    const reservation = makeReservation({
      messages: [
        { user_id: 10, role: null, content: 'From the mentor side' },
        { user_id: 20, role: undefined, content: 'From the mentee side' },
      ],
    });
    const result = mapToReservation(reservation);
    expect(result.mentorMessage).toEqual({
      content: 'From the mentor side',
      role: 'MENTOR',
    });
    expect(result.menteeMessage).toEqual({
      content: 'From the mentee side',
      role: 'MENTEE',
    });
  });

  it('message from unknown user with unknown role → kept in messages but no role attached', () => {
    const reservation = makeReservation({
      messages: [
        // Exercise the runtime fallback against malformed API data too.
        { user_id: 999, role: 'OTHER' as never, content: 'Wrong user' },
      ],
    });
    const result = mapToReservation(reservation);
    expect(result.menteeMessage).toBeUndefined();
    expect(result.mentorMessage).toBeUndefined();
    expect(result.messages).toEqual([{ content: 'Wrong user' }]);
  });

  it('job_title present, years_of_experience empty → roleLine has no trailing comma', () => {
    const result = mapToReservation(
      makeReservation({
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: 'Bob',
          avatar: '',
          job_title: 'Product Manager',
          years_of_experience: '',
        },
      })
    );
    expect(result.roleLine).toBe('Product Manager');
  });

  it('both job_title and years_of_experience empty → roleLine is empty string', () => {
    const result = mapToReservation(
      makeReservation({
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: 'Bob',
          avatar: '',
          job_title: '',
          years_of_experience: '',
        },
      })
    );
    expect(result.roleLine).toBe('');
  });

  it('name is empty string → name falls back to "—"', () => {
    const result = mapToReservation(
      makeReservation({
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: '',
          avatar: '',
          job_title: '',
          years_of_experience: '',
        },
      })
    );
    expect(result.name).toBe('—');
  });

  /* ============================
   * cancelledBy — Tracker #224
   * Badge fires whenever either side rejected/cancelled, with the canceller's
   * role surfaced. Participant takes precedence when both sides are REJECT.
   * ============================ */

  it('participant (MENTEE) has REJECT status → cancelledBy = MENTEE', () => {
    const result = mapToReservation(
      makeReservation({
        sender: {
          user_id: 10,
          role: 'MENTOR',
          status: 'ACCEPT',
          name: 'Alice',
          avatar: '',
          job_title: 'Engineer',
          years_of_experience: 'THREE_TO_FIVE',
        },
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'REJECT',
          name: 'Bob',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
      })
    );
    expect(result.cancelledBy).toBe('MENTEE');
  });

  it('participant (MENTOR) has REJECT status → cancelledBy = MENTOR', () => {
    const result = mapToReservation(
      makeReservation({
        sender: {
          user_id: 10,
          role: 'MENTEE',
          status: 'PENDING',
          name: 'Alice',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
        participant: {
          user_id: 20,
          role: 'MENTOR',
          status: 'REJECT',
          name: 'Bob',
          avatar: '',
          job_title: 'Engineer',
          years_of_experience: 'THREE_TO_FIVE',
        },
      })
    );
    expect(result.cancelledBy).toBe('MENTOR');
  });

  it('sender (self/MENTOR) has REJECT status → cancelledBy = MENTOR (self-cancel still shown)', () => {
    const result = mapToReservation(
      makeReservation({
        sender: {
          user_id: 10,
          role: 'MENTOR',
          status: 'REJECT',
          name: 'Alice',
          avatar: '',
          job_title: 'Engineer',
          years_of_experience: 'THREE_TO_FIVE',
        },
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'ACCEPT',
          name: 'Bob',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
      })
    );
    expect(result.cancelledBy).toBe('MENTOR');
  });

  it('sender (self/MENTEE) has REJECT status → cancelledBy = MENTEE (self-cancel still shown)', () => {
    const result = mapToReservation(
      makeReservation({
        sender: {
          user_id: 10,
          role: 'MENTEE',
          status: 'REJECT',
          name: 'Alice',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
        participant: {
          user_id: 20,
          role: 'MENTOR',
          status: 'PENDING',
          name: 'Bob',
          avatar: '',
          job_title: 'Engineer',
          years_of_experience: 'THREE_TO_FIVE',
        },
      })
    );
    expect(result.cancelledBy).toBe('MENTEE');
  });

  it('both sides have REJECT status → cancelledBy resolves to participant (other) side', () => {
    const result = mapToReservation(
      makeReservation({
        sender: {
          user_id: 10,
          role: 'MENTOR',
          status: 'REJECT',
          name: 'Alice',
          avatar: '',
          job_title: 'Engineer',
          years_of_experience: 'THREE_TO_FIVE',
        },
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'REJECT',
          name: 'Bob',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
      })
    );
    expect(result.cancelledBy).toBe('MENTEE');
  });

  it('participant has REJECT but unknown role → cancelledBy is undefined (defensive)', () => {
    const result = mapToReservation(
      makeReservation({
        participant: {
          user_id: 20,
          role: 'OTHER' as never,
          status: 'REJECT',
          name: 'Bob',
          avatar: '',
          job_title: 'Designer',
          years_of_experience: 'ONE_TO_THREE',
        },
      })
    );
    expect(result.cancelledBy).toBeUndefined();
  });

  it('no REJECT anywhere → cancelledBy is undefined', () => {
    const result = mapToReservation(makeReservation());
    expect(result.cancelledBy).toBeUndefined();
  });

  /* ============================
   * version (optimistic lock) — X-Talent-Backend PR #44
   * ============================ */

  it('version absent from API response → defaults to 0', () => {
    const result = mapToReservation(makeReservation());
    expect(result.version).toBe(0);
  });

  it('version present in API response → passed through', () => {
    const result = mapToReservation({ ...makeReservation(), version: 5 });
    expect(result.version).toBe(5);
  });

  /* ============================
   * myUserId matching (counterparty resolution)
   * ============================ */

  it('myUserId is omitted (undefined or null) → counterparty defaults to participant for backward compatibility', () => {
    const reservation = makeReservation();
    const resultUndefined = mapToReservation(reservation);
    const resultNull = mapToReservation(reservation, null);

    expect(resultUndefined.name).toBe('Bob');
    expect(resultUndefined.participantUserId).toBe(20);

    expect(resultNull.name).toBe('Bob');
    expect(resultNull.participantUserId).toBe(20);
  });

  it('myUserId matches sender.user_id → counterparty is set to participant', () => {
    const reservation = makeReservation();
    const result = mapToReservation(reservation, 10); // sender user_id is 10
    // counterparty is participant (Bob)
    expect(result.name).toBe('Bob');
  });

  it('myUserId matches sender.user_id as string/number mismatch → type-agnostically resolves counterparty to participant', () => {
    const reservation = makeReservation();
    const result = mapToReservation(reservation, '10'); // sender user_id is 10 (number)
    // counterparty is participant (Bob)
    expect(result.name).toBe('Bob');
  });

  it('myUserId does NOT match sender.user_id → counterparty is set to sender', () => {
    const reservation = makeReservation();
    const result = mapToReservation(reservation, 20); // myUserId is 20 (participant user_id, not sender)
    // counterparty is sender (Alice, user_id: 10)
    expect(result.name).toBe('Alice');
  });

  it('myUserId is provided but sender is null/undefined → falls back to participant to prevent crash', () => {
    const reservation = makeReservation({
      sender: fromAny(null),
    });
    const result = mapToReservation(reservation, 10);
    expect(result.name).toBe('Bob');
    expect(result.participantUserId).toBe(20);
  });

  it('myUserId matches sender.user_id but participant is null/undefined → falls back to sender to prevent crash', () => {
    const reservation = makeReservation({
      participant: fromAny(null),
    });
    const result = mapToReservation(reservation, 10); // matches sender.user_id, falls back to sender (Alice)
    expect(result.name).toBe('Alice');
    expect(result.senderUserId).toBe(10);
  });

  describe('dynamic counterparty resolution using myUserId', () => {
    const baseSender = {
      user_id: 10,
      role: 'MENTEE' as const,
      status: 'PENDING' as const,
      name: 'Bob (Mentee)',
      avatar: 'bob-avatar.png',
      job_title: 'Designer',
      years_of_experience: 'ONE_TO_THREE',
    };

    const baseParticipant = {
      user_id: 20,
      role: 'MENTOR' as const,
      status: 'ACCEPT' as const,
      name: 'Alice (Mentor)',
      avatar: 'alice-avatar.png',
      job_title: 'Engineer',
      years_of_experience: 'THREE_TO_FIVE',
    };

    it('myUserId matches sender.user_id → counterparty should be participant', () => {
      const reservation = makeReservation({
        sender: baseSender,
        participant: baseParticipant,
      });

      // myUserId is 10, which matches sender.user_id
      const result = mapToReservation(reservation, '10');

      expect(result.name).toBe('Alice (Mentor)');
      expect(result.avatar).toBe('alice-avatar.png');
      expect(result.roleLine).toBe('Engineer, 3~5 年');
    });

    it('myUserId matches participant.user_id → counterparty should be sender', () => {
      const reservation = makeReservation({
        sender: baseSender,
        participant: baseParticipant,
      });

      // myUserId is 20, which matches participant.user_id
      const result = mapToReservation(reservation, '20');

      expect(result.name).toBe('Bob (Mentee)');
      expect(result.avatar).toBe('bob-avatar.png');
      expect(result.roleLine).toBe('Designer, 1~3 年');
    });

    it('myUserId is not provided → fallback to participant as counterparty', () => {
      const reservation = makeReservation({
        sender: baseSender,
        participant: baseParticipant,
      });

      // myUserId is omitted
      const result = mapToReservation(reservation);

      expect(result.name).toBe('Alice (Mentor)');
      expect(result.avatar).toBe('alice-avatar.png');
      expect(result.roleLine).toBe('Engineer, 3~5 年');
    });

    it('myUserId is provided but unmatched → fallback to sender as counterparty', () => {
      const reservation = makeReservation({
        sender: baseSender,
        participant: baseParticipant,
      });

      // myUserId is unmatched (e.g. '999')
      const result = mapToReservation(reservation, '999');

      expect(result.name).toBe('Bob (Mentee)');
      expect(result.avatar).toBe('bob-avatar.png');
      expect(result.roleLine).toBe('Designer, 1~3 年');
    });

    it('when reservation.sender.user_id is null → does not crash and correctly identifies sender as counterparty', () => {
      const reservation = makeReservation({
        sender: {
          ...baseSender,
          user_id: null as unknown as number,
        },
        participant: baseParticipant,
      });

      const result = mapToReservation(reservation, '20');
      expect(result.name).toBe('Bob (Mentee)');
    });

    describe('cancelledBy precedence rules with dynamic counterparty', () => {
      it('myUserId is sender (MENTEE) and participant (MENTOR) is REJECT → cancelledBy is MENTOR (other party takes precedence)', () => {
        const reservation = makeReservation({
          sender: { ...baseSender, status: 'ACCEPT' },
          participant: { ...baseParticipant, status: 'REJECT' },
        });

        // Current user is 10, so counterparty is 20 (MENTOR) who has REJECT
        const result = mapToReservation(reservation, '10');
        expect(result.cancelledBy).toBe('MENTOR');
      });

      it('myUserId is participant (MENTOR) and sender (MENTEE) is REJECT → cancelledBy is MENTEE (other party takes precedence)', () => {
        const reservation = makeReservation({
          sender: { ...baseSender, status: 'REJECT' },
          participant: { ...baseParticipant, status: 'ACCEPT' },
        });

        // Current user is 20, so counterparty is 10 (MENTEE) who has REJECT
        const result = mapToReservation(reservation, '20');
        expect(result.cancelledBy).toBe('MENTEE');
      });

      it('both parties are REJECT and myUserId is participant (MENTOR) → cancelledBy is MENTEE (other party takes precedence when both are REJECT)', () => {
        const reservation = makeReservation({
          sender: { ...baseSender, status: 'REJECT' },
          participant: { ...baseParticipant, status: 'REJECT' },
        });

        // Current user is 20, so counterparty is 10 (MENTEE) who has REJECT.
        // Even though current user (20) also has REJECT, the other party (10) must take precedence.
        const result = mapToReservation(reservation, '20');
        expect(result.cancelledBy).toBe('MENTEE');
      });

      it('both parties are REJECT and myUserId is sender (MENTEE) → cancelledBy is MENTOR (other party takes precedence when both are REJECT)', () => {
        const reservation = makeReservation({
          sender: { ...baseSender, status: 'REJECT' },
          participant: { ...baseParticipant, status: 'REJECT' },
        });

        // Current user is 10, so counterparty is 20 (MENTOR) who has REJECT.
        // Even though current user (10) also has REJECT, the other party (20) must take precedence.
        const result = mapToReservation(reservation, '10');
        expect(result.cancelledBy).toBe('MENTOR');
      });
    });
  });
});

/* ================================
 * resolveCounterpartyProfile
 * ================================ */

describe('resolveCounterpartyProfile', () => {
  const baseSender = {
    user_id: 10,
    role: 'MENTEE' as const,
    status: 'PENDING' as const,
    name: 'Bob (Mentee)',
    avatar: 'bob-avatar.png',
    job_title: 'Designer',
    years_of_experience: 'ONE_TO_THREE',
  };

  const baseParticipant = {
    user_id: 20,
    role: 'MENTOR' as const,
    status: 'ACCEPT' as const,
    name: 'Alice (Mentor)',
    avatar: 'alice-avatar.png',
    job_title: 'Engineer',
    years_of_experience: 'THREE_TO_FIVE',
  };

  it('myUserId matches sender.user_id → counterparty is participant', () => {
    const reservation = makeReservation({
      sender: baseSender,
      participant: baseParticipant,
    });
    const result = resolveCounterpartyProfile(reservation, 10);
    expect(result.name).toBe('Alice (Mentor)');
    expect(result.avatar).toBe('alice-avatar.png');
    expect(result.roleLine).toBe('Engineer, 3~5 年');
  });

  it('myUserId matches participant.user_id → counterparty is sender', () => {
    const reservation = makeReservation({
      sender: baseSender,
      participant: baseParticipant,
    });
    const result = resolveCounterpartyProfile(reservation, 20);
    expect(result.name).toBe('Bob (Mentee)');
    expect(result.avatar).toBe('bob-avatar.png');
    expect(result.roleLine).toBe('Designer, 1~3 年');
  });

  it('myUserId is omitted → fallback to participant', () => {
    const reservation = makeReservation({
      sender: baseSender,
      participant: baseParticipant,
    });
    const result = resolveCounterpartyProfile(reservation);
    expect(result.name).toBe('Alice (Mentor)');
  });

  it('myUserId is unmatched → fallback to sender', () => {
    const reservation = makeReservation({
      sender: baseSender,
      participant: baseParticipant,
    });
    const result = resolveCounterpartyProfile(reservation, 999);
    expect(result.name).toBe('Bob (Mentee)');
  });

  it('null sender → fallback to participant to prevent crash', () => {
    const reservation = makeReservation({
      sender: fromAny(null),
      participant: baseParticipant,
    });
    const result = resolveCounterpartyProfile(reservation, 10);
    expect(result.name).toBe('Alice (Mentor)');
  });

  it('null participant → fallback to sender to prevent crash', () => {
    const reservation = makeReservation({
      sender: baseSender,
      participant: fromAny(null),
    });
    const result = resolveCounterpartyProfile(reservation, 10);
    expect(result.name).toBe('Bob (Mentee)');
  });

  describe('cancelledBy precedence rules', () => {
    it('only counterparty has REJECT → cancelledBy is counterparty role', () => {
      const reservation = makeReservation({
        sender: { ...baseSender, status: 'ACCEPT' },
        participant: { ...baseParticipant, status: 'REJECT' },
      });
      // myUserId is 10 (sender), so counterparty is participant (MENTOR)
      const result = resolveCounterpartyProfile(reservation, 10);
      expect(result.cancelledBy).toBe('MENTOR');
    });

    it('only current user has REJECT → cancelledBy is current user role', () => {
      const reservation = makeReservation({
        sender: { ...baseSender, status: 'REJECT' },
        participant: { ...baseParticipant, status: 'ACCEPT' },
      });
      // myUserId is 10 (sender), so current user is sender (MENTEE), counterparty is MENTOR (ACCEPT)
      const result = resolveCounterpartyProfile(reservation, 10);
      expect(result.cancelledBy).toBe('MENTEE');
    });

    it('both parties have REJECT → cancelledBy resolves to counterparty (other side takes precedence)', () => {
      const reservation = makeReservation({
        sender: { ...baseSender, status: 'REJECT' },
        participant: { ...baseParticipant, status: 'REJECT' },
      });
      // myUserId is 10 (sender), counterparty is participant (MENTOR)
      const result = resolveCounterpartyProfile(reservation, 10);
      expect(result.cancelledBy).toBe('MENTOR');
    });
  });
});

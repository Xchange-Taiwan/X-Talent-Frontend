import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  formatExperience,
  mapToReservation,
  ReservationState,
} from '@/services/reservations';
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

function makeReservationWithState(
  overrides: Partial<ReservationInfoVO>,
  state: ReservationState
) {
  return mapToReservation(makeReservation(overrides), state);
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
  it('MENTOR_PENDING → counterpartyMessage picks the mentee message (participant.user_id)', () => {
    const reservation = makeReservation({
      messages: [{ user_id: 20, role: 'MENTEE', content: 'Hello mentor!' }],
    });
    const result = mapToReservation(reservation, 'MENTOR_PENDING');
    expect(result.counterpartyMessage).toEqual({
      role: 'MENTEE',
      content: 'Hello mentor!',
    });
  });

  it('MENTEE_PENDING → counterpartyMessage picks the mentor reply (participant.user_id)', () => {
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
    const result = mapToReservation(reservation, 'MENTEE_PENDING');
    expect(result.counterpartyMessage).toEqual({
      role: 'MENTOR',
      content: 'See you on Google Meet.',
    });
  });

  it('multiple counterparty messages → counterpartyMessage uses the latest one', () => {
    const reservation = makeReservation({
      messages: [
        { user_id: 20, role: 'MENTEE', content: 'First note' },
        { user_id: 20, role: 'MENTEE', content: 'Updated note' },
      ],
    });
    const result = mapToReservation(reservation, 'MENTOR_PENDING');
    expect(result.counterpartyMessage).toEqual({
      role: 'MENTEE',
      content: 'Updated note',
    });
  });

  it('blank counterparty message → counterpartyMessage is undefined', () => {
    const reservation = makeReservation({
      messages: [{ user_id: 20, role: 'MENTEE', content: '   ' }],
    });
    const result = mapToReservation(reservation, 'MENTOR_PENDING');
    expect(result.counterpartyMessage).toBeUndefined();
  });

  it('job_title present, years_of_experience empty → roleLine has no trailing comma', () => {
    const result = makeReservationWithState(
      {
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: 'Bob',
          avatar: '',
          job_title: 'Product Manager',
          years_of_experience: '',
        },
      },
      'MENTOR_UPCOMING'
    );
    expect(result.roleLine).toBe('Product Manager');
  });

  it('both job_title and years_of_experience empty → roleLine is empty string', () => {
    const result = makeReservationWithState(
      {
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: 'Bob',
          avatar: '',
          job_title: '',
          years_of_experience: '',
        },
      },
      'MENTOR_UPCOMING'
    );
    expect(result.roleLine).toBe('');
  });

  it('name is empty string → name falls back to "—"', () => {
    const result = makeReservationWithState(
      {
        participant: {
          user_id: 20,
          role: 'MENTEE',
          status: 'PENDING',
          name: '',
          avatar: '',
          job_title: '',
          years_of_experience: '',
        },
      },
      'MENTOR_UPCOMING'
    );
    expect(result.name).toBe('—');
  });

  it('no matching counterparty message → counterpartyMessage is undefined', () => {
    const reservation = makeReservation({
      messages: [{ user_id: 999, role: 'OTHER', content: 'Wrong user' }],
    });
    const result = mapToReservation(reservation, 'MENTOR_PENDING');
    expect(result.counterpartyMessage).toBeUndefined();
  });
});

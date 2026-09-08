import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { resolveReservationViewer } from './reservationViewerModel';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
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
    const reservation = makeReservation({
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
    const reservation = makeReservation({
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
    const reservation = makeReservation({
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
    const reservation = makeReservation();
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: undefined,
    });
    expect(profileHref).toBeUndefined();
  });

  it('resolves profileHref to undefined when myUserId is an empty string', () => {
    const reservation = makeReservation();
    const { profileHref } = resolveReservationViewer({
      reservation,
      myUserId: '',
    });
    expect(profileHref).toBeUndefined();
  });

  it('resolves correctly when senderUserId is missing/empty (prevent crash fallback)', () => {
    const reservation = makeReservation({
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
    const reservation = makeReservation({
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
    const reservation = makeReservation({
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
    const reservation = makeReservation({
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
    const reservation = makeReservation({ viewerRole: 'MENTOR' });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBe('mentor');
  });

  it('derives mentee from Reservation.viewerRole', () => {
    const reservation = makeReservation({ viewerRole: 'MENTEE' });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBe('mentee');
  });

  it('is undefined when the reservation carries no role data', () => {
    const reservation = makeReservation({ viewerRole: undefined });
    const { viewerRole } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(viewerRole).toBeUndefined();
  });
});

describe('resolveReservationViewer - cancelledByLabel', () => {
  it('is undefined when the reservation was not cancelled', () => {
    const reservation = makeReservation({ cancelledBy: undefined });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBeUndefined();
  });

  it('renders the mentor-cancelled label', () => {
    const reservation = makeReservation({ cancelledBy: 'MENTOR' });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBe('已由導師取消');
  });

  it('renders the mentee-cancelled label', () => {
    const reservation = makeReservation({ cancelledBy: 'MENTEE' });
    const { cancelledByLabel } = resolveReservationViewer({
      reservation,
      myUserId: 'user-sender',
    });
    expect(cancelledByLabel).toBe('已由學員取消');
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

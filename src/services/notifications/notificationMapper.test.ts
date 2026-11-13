import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import { mapNotificationVOToItem } from '@/services/notifications/notificationMapper';
import { type components } from '@/types/api';

describe('mapNotificationVOToItem', () => {
  const baseApiItem: components['schemas']['NotificationVO'] = {
    id: 1,
    type: 'reservation_requested',
    metadata: { role: 'mentor', counterparty_name: 'Alice' },
    created_at: 0,
    read_at: null,
  };

  it('treats a seconds-precision created_at (below the ms threshold) as seconds', () => {
    const secondsTimestamp = 1700000000; // seconds precision, well under 9999999999
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      created_at: secondsTimestamp,
    });

    expect(item.createdAt).toBe(
      new Date(secondsTimestamp * 1000).toISOString()
    );
  });

  it('treats a milliseconds-precision created_at (at/above the ms threshold) as milliseconds', () => {
    const millisecondsTimestamp = 1700000000000; // >= 9999999999, ms precision
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      created_at: millisecondsTimestamp,
    });

    expect(item.createdAt).toBe(new Date(millisecondsTimestamp).toISOString());
  });

  it('does not throw when metadata is null (defensive against malformed backend payloads)', () => {
    expect(() =>
      mapNotificationVOToItem({
        ...baseApiItem,
        metadata: fromAny(null),
      })
    ).not.toThrow();

    const item = mapNotificationVOToItem({
      ...baseApiItem,
      metadata: fromAny(null),
    });
    expect(item.role).toBeUndefined();
    expect(item.menteeName).toBeUndefined();
    expect(item.mentorName).toBeUndefined();
  });

  it('does not throw and falls back to a valid ISO string when created_at is missing or invalid', () => {
    for (const invalidCreatedAt of [undefined, null, NaN]) {
      expect(() =>
        mapNotificationVOToItem({
          ...baseApiItem,
          created_at: fromAny(invalidCreatedAt),
        })
      ).not.toThrow();

      const item = mapNotificationVOToItem({
        ...baseApiItem,
        created_at: fromAny(invalidCreatedAt),
      });
      expect(() => new Date(item.createdAt).toISOString()).not.toThrow();
      expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
    }
  });

  it('maps unrecognized notification types to unknown safely without throwing', () => {
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'future_unrecognized_event',
    });

    expect(item.type).toBe('unknown');
  });

  it('maps role/counterparty_name to menteeName/mentorName based on role', () => {
    const mentorViewItem = mapNotificationVOToItem({
      ...baseApiItem,
      metadata: { role: 'mentor', counterparty_name: 'Mentee A' },
    });
    expect(mentorViewItem.menteeName).toBe('Mentee A');
    expect(mentorViewItem.mentorName).toBeUndefined();

    const menteeViewItem = mapNotificationVOToItem({
      ...baseApiItem,
      metadata: { role: 'mentee', counterparty_name: 'Mentor B' },
    });
    expect(menteeViewItem.mentorName).toBe('Mentor B');
    expect(menteeViewItem.menteeName).toBeUndefined();
  });

  it('derives unread from a null read_at', () => {
    expect(
      mapNotificationVOToItem({ ...baseApiItem, read_at: null }).unread
    ).toBe(true);
    expect(
      mapNotificationVOToItem({ ...baseApiItem, read_at: 1700000000 }).unread
    ).toBe(false);
  });

  it('maps actor_role, dtstart, and dtend from metadata when present', () => {
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_upcoming',
      metadata: {
        role: 'mentee',
        actor_role: 'system',
        counterparty_name: 'Mentor C',
        dtstart: 1755000000,
        dtend: 1755001800,
      },
    });
    expect(item.actorRole).toBe('system');
    expect(item.dtstart).toBe(1755000000);
    expect(item.dtend).toBe(1755001800);
  });

  it('maps Mentor feedback-received notifications with full mentee name and reservationId (#734)', () => {
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      id: 734,
      type: 'feedback_received',
      metadata: {
        role: 'mentor',
        counterparty_name: '王小明',
        reservation_id: 401,
      },
    });

    expect(item.type).toBe('feedback_received');
    expect(item.role).toBe('mentor');
    expect(item.menteeName).toBe('王小明');
    expect(item.mentorName).toBeUndefined();
    expect(item.reservationId).toBe('401');
  });

  it('normalizes feedback-received aliases and enforces mentor role with full menteeName (#734)', () => {
    const reservationPrefixed = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_feedback_received',
      metadata: {
        counterparty_name: '林怡君',
        reservation_id: '512',
      },
    });
    expect(reservationPrefixed.type).toBe('feedback_received');
    expect(reservationPrefixed.role).toBe('mentor');
    expect(reservationPrefixed.menteeName).toBe('林怡君');
    expect(reservationPrefixed.reservationId).toBe('512');

    const meetingPrefixed = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'meeting_feedback_received',
      metadata: {
        mentee_name: '張大文',
        session_link:
          'https://xtalent.xchange.com.tw/reservation/mentor?tab=history&reservationId=608',
      },
    });
    expect(meetingPrefixed.type).toBe('feedback_received');
    expect(meetingPrefixed.role).toBe('mentor');
    expect(meetingPrefixed.menteeName).toBe('張大文');
    expect(meetingPrefixed.reservationId).toBe('608');

    const uppercaseWithActorRoleMismatch = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'FEEDBACK_RECEIVED',
      metadata: {
        role: 'mentee',
        counterparty_name: '蘇元貞',
        reservationId: 709,
      },
    });
    expect(uppercaseWithActorRoleMismatch.type).toBe('feedback_received');
    expect(uppercaseWithActorRoleMismatch.role).toBe('mentor');
    expect(uppercaseWithActorRoleMismatch.menteeName).toBe('蘇元貞');
    expect(uppercaseWithActorRoleMismatch.mentorName).toBeUndefined();
    expect(uppercaseWithActorRoleMismatch.reservationId).toBe('709');
  });

  it('gracefully omits reservationId when reservation_id and session_link are missing, zero, or invalid (#734)', () => {
    const item = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'feedback_received',
      metadata: {
        role: 'mentor',
        counterparty_name: '王小明',
        reservation_id: 0,
        session_link: '   ',
      },
    });

    expect(item.reservationId).toBeUndefined();
  });
});

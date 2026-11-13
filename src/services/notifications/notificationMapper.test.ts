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
        metadata: null as unknown as Record<string, unknown>,
      })
    ).not.toThrow();

    const item = mapNotificationVOToItem({
      ...baseApiItem,
      metadata: null as unknown as Record<string, unknown>,
    });
    expect(item.role).toBeUndefined();
    expect(item.menteeName).toBeUndefined();
    expect(item.mentorName).toBeUndefined();
  });

  it('does not throw and falls back to a valid ISO string when created_at is missing or invalid', () => {
    for (const invalidCreatedAt of [
      undefined,
      null,
      NaN,
    ] as unknown as number[]) {
      expect(() =>
        mapNotificationVOToItem({
          ...baseApiItem,
          created_at: invalidCreatedAt,
        })
      ).not.toThrow();

      const item = mapNotificationVOToItem({
        ...baseApiItem,
        created_at: invalidCreatedAt,
      });
      expect(() => new Date(item.createdAt).toISOString()).not.toThrow();
      expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
    }
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

  it('maps feedback_reminder notifications and normalizes metadata.reservation_id for Mentor and Mentee (#733)', () => {
    const mentorItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'feedback_reminder',
      metadata: {
        role: 'mentor',
        counterparty_name: '林學員',
        reservation_id: 201,
      },
    });
    expect(mentorItem.type).toBe('feedback_reminder');
    expect(mentorItem.role).toBe('mentor');
    expect(mentorItem.menteeName).toBe('林學員');
    expect(mentorItem.reservationId).toBe('201');

    const menteeStringIdItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_feedback_reminder',
      metadata: {
        role: 'mentee',
        counterparty_name: 'Emily Chen',
        reservation_id: ' 101 ',
      },
    });
    expect(menteeStringIdItem.type).toBe('reservation_feedback_reminder');
    expect(menteeStringIdItem.mentorName).toBe('Emily Chen');
    expect(menteeStringIdItem.reservationId).toBe('101');

    const missingReservationIdItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'feedback_reminder',
      metadata: {
        role: 'mentee',
        counterparty_name: 'Emily Chen',
        reservation_id: '',
      },
    });
    expect(missingReservationIdItem.reservationId).toBeUndefined();
  });

  it('maps feedback_received variants for Mentor with full menteeName and reservationId normalization (#734)', () => {
    const standardItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'feedback_received',
      metadata: {
        role: 'mentor',
        counterparty_name: 'Zahra Mirzakhani',
        reservation_id: 201,
      },
    });
    expect(standardItem.type).toBe('feedback_received');
    expect(standardItem.role).toBe('mentor');
    expect(standardItem.menteeName).toBe('Zahra Mirzakhani');
    expect(standardItem.mentorName).toBeUndefined();
    expect(standardItem.reservationId).toBe('201');

    const inferredMentorRoleItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_feedback_received',
      metadata: {
        counterparty_name: ' 王小明 ',
        reservation_id: ' 305 ',
      },
    });
    expect(inferredMentorRoleItem.type).toBe('reservation_feedback_received');
    expect(inferredMentorRoleItem.role).toBe('mentor');
    expect(inferredMentorRoleItem.menteeName).toBe('王小明');
    expect(inferredMentorRoleItem.reservationId).toBe('305');

    const explicitMenteeFieldItem = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'meeting_feedback_received',
      metadata: {
        mentee_name: '林學員',
        reserve_id: 408,
      },
    });
    expect(explicitMenteeFieldItem.type).toBe('meeting_feedback_received');
    expect(explicitMenteeFieldItem.role).toBe('mentor');
    expect(explicitMenteeFieldItem.menteeName).toBe('林學員');
    expect(explicitMenteeFieldItem.reservationId).toBe('408');
  });

  it('maps #760 §7 official types reservation_feedback_requested and reservation_attendance_requested with default roles (#875)', () => {
    const menteeReq = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_feedback_requested',
      metadata: {
        counterparty_name: 'Emily Chen',
        reservation_id: 101,
      },
    });
    expect(menteeReq.type).toBe('reservation_feedback_requested');
    expect(menteeReq.role).toBe('mentee');
    expect(menteeReq.mentorName).toBe('Emily Chen');
    expect(menteeReq.reservationId).toBe('101');

    const mentorAttendanceReq = mapNotificationVOToItem({
      ...baseApiItem,
      type: 'reservation_attendance_requested',
      metadata: {
        role: 'MENTOR' as unknown as 'mentor',
        counterparty_name: '林學員',
        reservation_id: 205,
      },
    });
    expect(mentorAttendanceReq.type).toBe('reservation_attendance_requested');
    expect(mentorAttendanceReq.role).toBe('mentor');
    expect(mentorAttendanceReq.menteeName).toBe('林學員');
    expect(mentorAttendanceReq.reservationId).toBe('205');
  });
});

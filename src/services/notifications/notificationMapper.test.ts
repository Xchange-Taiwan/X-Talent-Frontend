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
});

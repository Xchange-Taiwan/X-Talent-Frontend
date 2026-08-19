import { describe, expect, it } from 'vitest';

import { type NotificationItem } from '@/hooks/useNotificationCenter';

import {
  getNotificationContent,
  getNotificationHref,
} from './notificationUtils';

function buildItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'test-id',
    type: 'reservation_requested',
    createdAt: new Date().toISOString(),
    unread: false,
    ...overrides,
  };
}

describe('notificationUtils', () => {
  describe.each([
    {
      type: 'reservation_requested' as const,
      role: undefined,
      menteeName: '小明',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=pending',
      expectedTitle: '您有新的預約',
    },
    {
      type: 'reservation_success' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '林導師',
      expectedHref: '/reservation/mentee?tab=upcoming',
      expectedTitle: '林導師 已接受您的預約',
    },
    {
      type: 'reservation_failed' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '王導師',
      expectedHref: '/mentor-pool',
      expectedTitle: '您與 王導師 的預約已被拒絕',
    },
    {
      type: 'reservation_canceled' as const,
      role: 'mentor' as const,
      menteeName: '小明',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=history',
      expectedTitle: '您與 小明 的預約已被取消',
    },
    {
      type: 'reservation_canceled' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '陳導師',
      expectedHref: '/mentor-pool',
      expectedTitle: '您與 陳導師 的預約已被取消',
    },
    {
      type: 'reservation_upcoming' as const,
      role: 'mentor' as const,
      menteeName: '小華',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=upcoming',
      expectedTitle: '您與 小華 的預約即將到來',
    },
    {
      type: 'reservation_upcoming' as const,
      // role undefined but menteeName present: inferred as mentor context
      role: undefined,
      menteeName: '小華',
      mentorName: undefined,
      expectedHref: '/reservation/mentor?tab=upcoming',
      expectedTitle: '您與 小華 的預約即將到來',
    },
    {
      type: 'reservation_upcoming' as const,
      role: undefined,
      menteeName: undefined,
      mentorName: '張導師',
      expectedHref: '/reservation/mentee?tab=upcoming',
      expectedTitle: '您與 張導師 的預約即將到來',
    },
  ])(
    '$type (role=$role, menteeName=$menteeName, mentorName=$mentorName)',
    ({ type, role, menteeName, mentorName, expectedHref, expectedTitle }) => {
      const item = buildItem({ type, role, menteeName, mentorName });

      it(`resolves href to ${expectedHref}`, () => {
        expect(getNotificationHref(item)).toBe(expectedHref);
      });

      it('resolves the expected title', () => {
        expect(getNotificationContent(item).title).toBe(expectedTitle);
      });
    }
  );

  it('falls back to a generic title/body and root href for an unrecognized type', () => {
    const item = buildItem({
      type: 'some_future_type' as NotificationItem['type'],
    });

    expect(getNotificationContent(item)).toEqual({
      title: '通知',
      body: '您有一則新通知',
    });
    expect(getNotificationHref(item)).toBe('/');
  });
});

import dayjs from 'dayjs';
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

  it('formats reservation_upcoming body with dtstart when present and falls back to 24h copy when absent', () => {
    const dtstart = 1755000000;
    const formatted = dayjs.unix(dtstart).format('YYYY/MM/DD HH:mm');
    const withTime = buildItem({
      type: 'reservation_upcoming',
      role: 'mentee',
      mentorName: '張導師',
      dtstart,
    });
    expect(getNotificationContent(withTime)).toEqual({
      title: '您與 張導師 的預約即將到來',
      body: `您與 張導師 的會議即將在 ${formatted} 開始，請準時上線`,
    });

    const withoutTime = buildItem({
      type: 'reservation_upcoming',
      role: 'mentee',
      mentorName: '張導師',
    });
    expect(getNotificationContent(withoutTime)).toEqual({
      title: '您與 張導師 的預約即將到來',
      body: '您 24 小時後有與 張導師 的會議，請準時上線',
    });
  });

  it('renders system auto-cancel copy for mentor and mentee when actorRole is system', () => {
    const menteeItem = buildItem({
      type: 'reservation_canceled',
      role: 'mentee',
      actorRole: 'system',
      mentorName: '陳導師',
    });
    expect(getNotificationContent(menteeItem)).toEqual({
      title: '您與 陳導師 的預約已自動取消',
      body: '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約，歡迎重新預約',
    });
    expect(getNotificationHref(menteeItem)).toBe('/mentor-pool');

    const mentorItem = buildItem({
      type: 'reservation_canceled',
      role: 'mentor',
      actorRole: 'system',
      menteeName: '小明',
    });
    expect(getNotificationContent(mentorItem)).toEqual({
      title: '您與 小明 的預約已自動取消',
      body: '因您未於預約開始前 24 小時前確認，系統已自動取消此預約',
    });
    expect(getNotificationHref(mentorItem)).toBe(
      '/reservation/mentor?tab=history'
    );
  });
});

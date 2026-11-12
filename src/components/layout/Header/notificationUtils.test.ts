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

  it('distinguishes mentor vs mentee body copy for non-system reservation_canceled (#858)', () => {
    const menteeItem = buildItem({
      type: 'reservation_canceled',
      role: 'mentee',
      actorRole: 'mentor',
      mentorName: '陳導師',
    });
    expect(getNotificationContent(menteeItem)).toEqual({
      title: '您與 陳導師 的預約已被取消',
      body: '您的預約已被取消，歡迎重新預約',
    });
    expect(getNotificationHref(menteeItem)).toBe('/mentor-pool');

    const mentorItemExplicit = buildItem({
      type: 'reservation_canceled',
      role: 'mentor',
      actorRole: 'mentee',
      menteeName: '小明',
    });
    expect(getNotificationContent(mentorItemExplicit)).toEqual({
      title: '您與 小明 的預約已被取消',
      body: '學員已取消此次預約，點擊查看預約紀錄',
    });
    expect(getNotificationHref(mentorItemExplicit)).toBe(
      '/reservation/mentor?tab=history'
    );

    const mentorItemInferred = buildItem({
      type: 'reservation_canceled',
      role: undefined,
      menteeName: '小華',
    });
    expect(getNotificationContent(mentorItemInferred)).toEqual({
      title: '您與 小華 的預約已被取消',
      body: '學員已取消此次預約，點擊查看預約紀錄',
    });
    expect(getNotificationHref(mentorItemInferred)).toBe(
      '/reservation/mentor?tab=history'
    );
  });

  it('renders Mentor feedback-received title, full mentee name body, and reservationId history href (#734)', () => {
    const feedbackItem = buildItem({
      type: 'feedback_received',
      role: 'mentor',
      menteeName: '王小明',
      reservationId: '401',
    });

    expect(getNotificationContent(feedbackItem)).toEqual({
      title: '您收到新的回饋',
      body: '王小明 為您留下了一則會談回饋，前往查看。',
    });
    expect(getNotificationHref(feedbackItem)).toBe(
      '/reservation/mentor?tab=history&reservationId=401'
    );

    const encodedReservationItem = buildItem({
      type: 'feedback_received',
      menteeName: 'Emily Chen',
      reservationId: 'res-42&extra=1',
    });

    expect(getNotificationContent(encodedReservationItem)).toEqual({
      title: '您收到新的回饋',
      body: 'Emily Chen 為您留下了一則會談回饋，前往查看。',
    });
    expect(getNotificationHref(encodedReservationItem)).toBe(
      '/reservation/mentor?tab=history&reservationId=res-42%26extra%3D1'
    );
  });

  it('falls back gracefully when feedback-received notification omits reservationId or menteeName (#734)', () => {
    const fallbackItem = buildItem({
      type: 'feedback_received',
      menteeName: '   ',
      reservationId: '   ',
    });

    expect(getNotificationContent(fallbackItem)).toEqual({
      title: '您收到新的回饋',
      body: 'Mentee 為您留下了一則會談回饋，前往查看。',
    });
    expect(getNotificationHref(fallbackItem)).toBe(
      '/reservation/mentor?tab=history'
    );
  });
});

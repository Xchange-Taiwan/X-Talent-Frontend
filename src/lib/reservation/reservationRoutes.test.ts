import { describe, expect, it } from 'vitest';

import {
  buildCleanedDeepLinkHref,
  buildCleanedFeedbackQueueHref,
  buildReservationHistoryRedirectHref,
  buildReservationHistorySignInCallbackHref,
  buildReservationTabHref,
  buildReservationTabSwitchHref,
  extractDeepLinkReservationId,
  getReservationRolePathname,
  isFeedbackQueueQueryRequested,
  isNotificationMentorContext,
  parseReservationSearchParams,
  resolveNotificationCategory,
  resolveNotificationTargetHref,
  stripDeepLinkQueryParams,
  stripFeedbackQueueQueryParam,
} from './reservationRoutes';

describe('reservationRoutes codec (#906)', () => {
  describe('extractDeepLinkReservationId & parseReservationSearchParams', () => {
    it('extracts reservation IDs across canonical and alias query keys while ignoring reserved keywords and boolean flags on ?feedback=', () => {
      expect(
        extractDeepLinkReservationId(new URLSearchParams('reservationId=1'))
      ).toBe('1');
      expect(
        extractDeepLinkReservationId(new URLSearchParams('reservation_id=205'))
      ).toBe('205');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('feedbackReservationId=res-99')
        )
      ).toBe('res-99');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedback=abc-123')
        )
      ).toBe('abc-123');

      expect(
        extractDeepLinkReservationId(new URLSearchParams('feedback=queue'))
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(new URLSearchParams('feedback=1'))
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(new URLSearchParams('feedback=0'))
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('reservationId=history')
        )
      ).toBeNull();
    });

    it('parses tab, deepLinkReservationId, and isFeedbackQueue together', () => {
      expect(
        parseReservationSearchParams('?tab=HISTORY&feedback=QUEUE')
      ).toEqual({
        tab: 'history',
        deepLinkReservationId: null,
        isFeedbackQueue: true,
      });

      expect(
        parseReservationSearchParams('tab=invalid&reservation_id=42')
      ).toEqual({
        tab: null,
        deepLinkReservationId: '42',
        isFeedbackQueue: false,
      });
    });
  });

  describe('URL building and single-use query parameter stripping', () => {
    it('builds role paths, tab hrefs, history redirect hrefs, and sign-in callback URLs', () => {
      expect(getReservationRolePathname('mentor')).toBe('/reservation/mentor');
      expect(getReservationRolePathname('mentee')).toBe('/reservation/mentee');

      expect(
        buildReservationTabHref('mentor', 'history', {
          reservationId: ' 201 ',
          feedbackQueue: true,
        })
      ).toBe(
        '/reservation/mentor?tab=history&reservationId=201&feedback=queue'
      );

      expect(
        buildReservationHistoryRedirectHref(
          'mentor',
          '?tab=upcoming&reservation_id=205&utm=email'
        )
      ).toBe('/reservation/mentor?tab=history&reservation_id=205&utm=email');

      expect(
        buildReservationHistorySignInCallbackHref('?reservation_id=101')
      ).toBe(
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101'
      );
      expect(buildReservationHistorySignInCallbackHref('')).toBe(
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory'
      );
    });

    it('cleans deep-link params safely even when rawSearch includes leading ? or encoded unrelated params', () => {
      expect(buildCleanedDeepLinkHref('/reservation/mentee', '')).toBeNull();
      expect(
        buildCleanedDeepLinkHref('/reservation/mentee', '?tab=history')
      ).toBeNull();
      expect(
        buildCleanedDeepLinkHref(
          '/reservation/mentee',
          '?tab=history&note=hello%20world&feedback=queue'
        )
      ).toBeNull();

      expect(
        buildCleanedDeepLinkHref(
          '/reservation/mentee',
          '?reservation_id=101&utm=mail'
        )
      ).toBe('/reservation/mentee?utm=mail&tab=history');

      expect(
        stripDeepLinkQueryParams('tab=history&reservationId=10&feedback=queue')
      ).toBe('tab=history&feedback=queue');
    });

    it('cleans only feedback=queue in buildCleanedFeedbackQueueHref without deleting single-session ?feedback=<id>', () => {
      expect(
        isFeedbackQueueQueryRequested(new URLSearchParams('feedback=QUEUE'))
      ).toBe(true);
      expect(
        buildCleanedFeedbackQueueHref('/reservation/mentor', '?feedback=res-88')
      ).toBeNull();
      expect(stripFeedbackQueueQueryParam('tab=history&feedback=res-88')).toBe(
        'tab=history&feedback=res-88'
      );

      expect(
        buildCleanedFeedbackQueueHref(
          '/reservation/mentor',
          '?tab=history&feedback=queue'
        )
      ).toBe('/reservation/mentor?tab=history');
      expect(
        buildCleanedFeedbackQueueHref('/reservation/mentee', 'feedback=queue')
      ).toBe('/reservation/mentee');
    });

    it('builds clean tab-switch hrefs removing transient deep-link and queue params', () => {
      expect(
        buildReservationTabSwitchHref(
          '/reservation/mentee',
          'tab=history&reservation_id=55&feedback=queue&foo=bar',
          'upcoming'
        )
      ).toBe('/reservation/mentee?tab=upcoming&foo=bar');
    });
  });

  describe('notification semantic categories & targetHref resolution', () => {
    it('classifies all reservation and feedback notification aliases into canonical semantic categories', () => {
      expect(resolveNotificationCategory('reservation_requested')).toBe(
        'reservation_requested'
      );
      expect(
        resolveNotificationCategory('reservation_feedback_requested')
      ).toBe('feedback_requested');
      expect(
        resolveNotificationCategory('reservation_attendance_requested')
      ).toBe('attendance_requested');
      expect(resolveNotificationCategory('feedback_reminder')).toBe(
        'feedback_reminder'
      );
      expect(resolveNotificationCategory('reservation_feedback_reminder')).toBe(
        'feedback_reminder'
      );
      expect(resolveNotificationCategory('meeting_feedback_reminder')).toBe(
        'feedback_reminder'
      );
      expect(resolveNotificationCategory('feedback_received')).toBe(
        'feedback_received'
      );
      expect(resolveNotificationCategory('reservation_feedback_received')).toBe(
        'feedback_received'
      );
      expect(resolveNotificationCategory('meeting_feedback_received')).toBe(
        'feedback_received'
      );
      expect(resolveNotificationCategory('unknown_future_event')).toBe(
        'unknown'
      );
    });

    it('infers mentor context and resolves canonical targetHref across all notification categories and role fallbacks', () => {
      expect(isNotificationMentorContext({ role: 'mentor' })).toBe(true);
      expect(
        isNotificationMentorContext({ role: undefined, menteeName: '林學員' })
      ).toBe(true);
      expect(
        isNotificationMentorContext({ role: 'mentee', menteeName: '林學員' })
      ).toBe(false);

      expect(
        resolveNotificationTargetHref({ type: 'reservation_requested' })
      ).toBe('/reservation/mentor?tab=pending');
      expect(
        resolveNotificationTargetHref({ type: 'reservation_success' })
      ).toBe('/reservation/mentee?tab=upcoming');
      expect(
        resolveNotificationTargetHref({ type: 'reservation_failed' })
      ).toBe('/mentor-pool');
      expect(
        resolveNotificationTargetHref({
          type: 'reservation_canceled',
          menteeName: '小明',
        })
      ).toBe('/reservation/mentor?tab=history');
      expect(
        resolveNotificationTargetHref({
          type: 'reservation_canceled',
          role: 'mentee',
        })
      ).toBe('/mentor-pool');

      expect(
        resolveNotificationTargetHref({
          type: 'reservation_feedback_requested',
          reservationId: '101',
        })
      ).toBe('/reservation/mentee?tab=history&reservationId=101');
      expect(
        resolveNotificationTargetHref({
          type: 'reservation_attendance_requested',
          reservationId: '205',
        })
      ).toBe('/reservation/mentor?tab=history&reservationId=205');

      // Reminder aliases: mentor inferred from menteeName vs default mentee
      expect(
        resolveNotificationTargetHref({
          type: 'meeting_feedback_reminder',
          menteeName: '林學員',
          reservationId: '301',
        })
      ).toBe('/reservation/mentor?tab=history&reservationId=301');
      expect(
        resolveNotificationTargetHref({
          type: 'reservation_feedback_reminder',
          reservationId: '302',
        })
      ).toBe('/reservation/mentee?tab=history&reservationId=302');

      expect(
        resolveNotificationTargetHref({
          type: 'meeting_feedback_received',
          reservationId: '401',
        })
      ).toBe('/reservation/mentor?tab=history&reservationId=401');
      expect(resolveNotificationTargetHref({ type: 'unrecognized_type' })).toBe(
        '/'
      );
    });
  });
});

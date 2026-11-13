import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  clearAllSessionPendingFeedbackState,
  getSessionPendingFeedbackState,
  isAuthResetRoute,
  markSessionPendingFeedbackChecked,
  markSessionPendingFeedbackDismissed,
  markSessionReservationSkipped,
  markSessionReservationSubmitted,
  shouldSuppressPendingFeedbackPopup,
  sortPendingFeedbackOldestFirst,
} from './pendingFeedbackGuard';

describe('pendingFeedbackGuard (#740)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  describe('shouldSuppressPendingFeedbackPopup', () => {
    it('allows eligible browsing pages such as /, /mentor-pool, /about, and /profile/123', () => {
      for (const pathname of [
        '/',
        '/mentor-pool',
        '/about',
        '/profile/123',
        '/profile/123/edit',
        '/profile/card',
      ]) {
        expect(
          shouldSuppressPendingFeedbackPopup({
            pathname,
            searchParams: new URLSearchParams(),
          })
        ).toBe(false);
      }
    });

    it('excludes auth, onboarding, reservation, booking, and maintenance routes', () => {
      for (const pathname of [
        null,
        '',
        '/auth',
        '/auth/signin',
        '/auth/signup',
        '/auth/onboarding',
        '/auth/google/callback/redirect',
        '/onboarding',
        '/onboarding/step-1',
        '/reservation',
        '/reservation/mentee',
        '/reservation/mentor',
        '/booking',
        '/booking/confirm',
        '/maintenance',
      ]) {
        expect(
          shouldSuppressPendingFeedbackPopup({
            pathname,
            searchParams: new URLSearchParams(),
          })
        ).toBe(true);
      }

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/profile/42/edit',
          searchParams: new URLSearchParams('mentor-onboarding=true'),
        })
      ).toBe(true);

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/profile/42/edit',
          searchParams: new URLSearchParams('onboarding=true'),
        })
      ).toBe(true);

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/profile/42',
          searchParams: new URLSearchParams('open-schedule=true'),
        })
      ).toBe(true);
    });

    it('yields when URL contains reservationId, feedbackReservationId, or feedback=queue', () => {
      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/',
          searchParams: new URLSearchParams('reservationId=101'),
        })
      ).toBe(true);

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/about',
          searchParams: new URLSearchParams('reservation_id=102'),
        })
      ).toBe(true);

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/mentor-pool',
          searchParams: new URLSearchParams('feedbackReservationId=202'),
        })
      ).toBe(true);

      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/mentor-pool',
          searchParams: new URLSearchParams('feedback=queue'),
        })
      ).toBe(true);

      // Whitespace-only query params do not suppress
      expect(
        shouldSuppressPendingFeedbackPopup({
          pathname: '/mentor-pool',
          searchParams: new URLSearchParams('reservationId=   '),
        })
      ).toBe(false);
    });
  });

  describe('isAuthResetRoute', () => {
    it('identifies /auth and /auth/* routes', () => {
      expect(isAuthResetRoute('/auth')).toBe(true);
      expect(isAuthResetRoute('/auth/signin')).toBe(true);
      expect(isAuthResetRoute('/mentor-pool')).toBe(false);
      expect(isAuthResetRoute(null)).toBe(false);
    });
  });

  describe('sortPendingFeedbackOldestFirst', () => {
    it('orders reservations chronologically from oldest to newest (由遠到近)', () => {
      const items: Reservation[] = [
        fromPartial<Reservation>({
          id: '30',
          name: 'Newest',
          dtstart: 1762000000,
          dtend: 1762001800,
        }),
        fromPartial<Reservation>({
          id: '10',
          name: 'Oldest',
          dtstart: 1760000000,
          dtend: 1760001800,
        }),
        fromPartial<Reservation>({
          id: '20',
          name: 'Middle',
          dtstart: 1761000000,
          dtend: 1761001800,
        }),
      ];

      const sorted = sortPendingFeedbackOldestFirst(items);
      expect(sorted.map((item) => item.id)).toEqual(['10', '20', '30']);
      // Input array is not mutated
      expect(items.map((item) => item.id)).toEqual(['30', '10', '20']);
    });
  });

  describe('sessionStorage skip/dismiss lifecycle', () => {
    it('tracks checked, queueEmpty, submittedIds, skippedIds, dismissed state, and clears cleanly on logout', () => {
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: false,
        dismissed: false,
        queueEmpty: false,
        submittedIds: [],
        skippedIds: [],
      });

      markSessionPendingFeedbackChecked('1', true);
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: true,
        dismissed: false,
        queueEmpty: false,
        submittedIds: [],
        skippedIds: [],
      });

      markSessionReservationSubmitted('1', '100', false);
      markSessionReservationSubmitted('1', '100', false);
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: true,
        dismissed: false,
        queueEmpty: false,
        submittedIds: ['100'],
        skippedIds: [],
      });

      markSessionReservationSkipped('1', '101');
      markSessionReservationSkipped('1', '101');
      markSessionReservationSkipped('1', '102');
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: true,
        dismissed: false,
        queueEmpty: false,
        submittedIds: ['100'],
        skippedIds: ['101', '102'],
      });

      markSessionReservationSubmitted('1', '103', true);
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: true,
        dismissed: false,
        queueEmpty: true,
        submittedIds: ['100', '103'],
        skippedIds: ['101', '102'],
      });

      markSessionPendingFeedbackDismissed('1', ['104']);
      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: true,
        dismissed: true,
        queueEmpty: true,
        submittedIds: ['100', '103'],
        skippedIds: ['101', '102', '104'],
      });

      window.sessionStorage.setItem('unrelated-key', 'keep');
      clearAllSessionPendingFeedbackState();

      expect(getSessionPendingFeedbackState('1')).toEqual({
        checked: false,
        dismissed: false,
        queueEmpty: false,
        submittedIds: [],
        skippedIds: [],
      });
      expect(window.sessionStorage.getItem('unrelated-key')).toBe('keep');
    });
  });
});

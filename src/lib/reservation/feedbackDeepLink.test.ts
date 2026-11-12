import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  extractDeepLinkReservationId,
  resolveDeepLinkOutcome,
  stripDeepLinkQueryParams,
} from './feedbackDeepLink';

describe('feedbackDeepLink helpers (#733)', () => {
  describe('extractDeepLinkReservationId', () => {
    it('extracts reservationId, reservation_id, or feedbackReservationId in priority order', () => {
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&reservationId=101')
        )
      ).toBe('101');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&reservation_id=202')
        )
      ).toBe('202');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedbackReservationId=303')
        )
      ).toBe('303');
    });

    it('accepts valid positive integer ID "1" on reservationId, reservation_id, and feedbackReservationId', () => {
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&reservationId=1')
        )
      ).toBe('1');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&reservation_id=1')
        )
      ).toBe('1');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedbackReservationId=1')
        )
      ).toBe('1');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&reservationId=1&feedback=1')
        )
      ).toBe('1');
    });

    it('supports feedback=<id> while ignoring feedback=queue, feedback=1, and reserved tab/flag tokens', () => {
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedback=404')
        )
      ).toBe('404');
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedback=queue')
        )
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedback=1')
        )
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('tab=history&feedback=0')
        )
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(new URLSearchParams('tab=history'))
      ).toBeNull();
      expect(
        extractDeepLinkReservationId(
          new URLSearchParams('reservationId=upcoming')
        )
      ).toBeNull();
    });
  });

  describe('stripDeepLinkQueryParams', () => {
    it('removes single-use deep-link params while preserving tab and unrelated params', () => {
      expect(
        stripDeepLinkQueryParams(
          'tab=history&reservationId=101&reservation_id=101&feedback=open'
        )
      ).toBe('tab=history');
      expect(
        stripDeepLinkQueryParams('tab=history&reservationId=1&feedback=1')
      ).toBe('tab=history');
    });

    it('preserves feedback=queue when stripping unrelated deep-link keys', () => {
      expect(stripDeepLinkQueryParams('tab=history&feedback=queue')).toBe(
        'tab=history&feedback=queue'
      );
      expect(
        stripDeepLinkQueryParams('tab=history&reservationId=1&feedback=QUEUE')
      ).toBe('tab=history&feedback=QUEUE');
    });
  });

  describe('resolveDeepLinkOutcome', () => {
    const pendingReservation = fromPartial<Reservation>({
      id: '101',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    });

    const pendingRateReservation = fromPartial<Reservation>({
      id: '105',
      feedback: {
        meetingHappened: true,
        rating: null,
        nextStep: 'RATE',
      },
    });

    const ratedReservation = fromPartial<Reservation>({
      id: '102',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 9,
          content: '收穫滿滿',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: 'T***',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    const notHappenedReservation = fromPartial<Reservation>({
      id: '103',
      feedback: {
        meetingHappened: false,
        rating: null,
        nextStep: null,
      },
    });

    const cancelledReservation = fromPartial<Reservation>({
      id: '104',
      cancelledBy: 'MENTOR',
    });

    const history = [
      pendingReservation,
      pendingRateReservation,
      ratedReservation,
      notHappenedReservation,
      cancelledReservation,
    ];

    it('returns not-found when targetReservationId does not exist in history', () => {
      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '999',
          history,
        })
      ).toEqual({ kind: 'not-found' });
    });

    it('resolves mentee-open-dialog when mentee reservation has nextStep === ANSWER or RATE', () => {
      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '101',
          history,
        })
      ).toEqual({
        kind: 'mentee-open-dialog',
        reservation: pendingReservation,
      });

      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '105',
          history,
        })
      ).toEqual({
        kind: 'mentee-open-dialog',
        reservation: pendingRateReservation,
      });
    });

    it('resolves mentee-already-rated when mentee already submitted a rating', () => {
      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '102',
          history,
        })
      ).toEqual({
        kind: 'mentee-already-rated',
        reservation: ratedReservation,
      });
    });

    it('resolves mentee-already-resolved with contextual reason for cancelled and not-happened', () => {
      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '103',
          history,
        })
      ).toEqual({
        kind: 'mentee-already-resolved',
        reservation: notHappenedReservation,
        reason: 'not-happened',
      });

      expect(
        resolveDeepLinkOutcome({
          role: 'mentee',
          targetReservationId: '104',
          history,
        })
      ).toEqual({
        kind: 'mentee-already-resolved',
        reservation: cancelledReservation,
        reason: 'cancelled',
      });
    });

    it('resolves mentor-locate-card for mentor role and flags public mentee rating for expansion', () => {
      expect(
        resolveDeepLinkOutcome({
          role: 'mentor',
          targetReservationId: '101',
          history,
        })
      ).toEqual({
        kind: 'mentor-locate-card',
        reservation: pendingReservation,
        shouldExpandFeedback: false,
      });

      expect(
        resolveDeepLinkOutcome({
          role: 'mentor',
          targetReservationId: '102',
          history,
        })
      ).toEqual({
        kind: 'mentor-locate-card',
        reservation: ratedReservation,
        shouldExpandFeedback: true,
      });
    });
  });
});

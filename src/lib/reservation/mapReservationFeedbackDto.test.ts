import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { RawReservationRating } from '@/types/reservationFeedback';

import {
  extractBackendIsPublic,
  extractBackendMeetingHappened,
  extractBackendMyMeetingHappened,
  mapReservationFeedbackDto,
  normalizeCancelledByDto,
  normalizeFeedbackCounterpartDto,
  resolveFeedbackPartyIds,
} from './mapReservationFeedbackDto';

describe('mapReservationFeedbackDto (#888)', () => {
  it('returns undefined when raw feedback is null, undefined, or non-object', () => {
    expect(mapReservationFeedbackDto(null)).toBeUndefined();
    expect(mapReservationFeedbackDto(undefined)).toBeUndefined();
    expect(mapReservationFeedbackDto(fromAny('invalid'))).toBeUndefined();
  });

  it('normalizes my_meeting_happened, mentor_meeting_happened, and meeting_happened fallback consistently', () => {
    expect(
      mapReservationFeedbackDto({
        meeting_happened: false,
        my_meeting_happened: true,
        rating: null,
        next_step: null,
      })
    ).toEqual({
      meetingHappened: false,
      myMeetingHappened: true,
      rating: null,
      nextStep: null,
    });

    expect(
      mapReservationFeedbackDto({
        meeting_happened: true,
        my_meeting_happened: null,
        rating: null,
        next_step: null,
      })
    ).toEqual({
      meetingHappened: true,
      myMeetingHappened: null,
      rating: null,
      nextStep: null,
    });

    expect(
      mapReservationFeedbackDto({
        meeting_happened: false,
        mentor_meeting_happened: false,
        rating: null,
        next_step: null,
      })
    ).toEqual({
      meetingHappened: false,
      myMeetingHappened: false,
      rating: null,
      nextStep: null,
    });

    expect(
      mapReservationFeedbackDto({
        meeting_happened: true,
        rating: null,
        next_step: 'RATE',
      })
    ).toEqual({
      meetingHappened: true,
      myMeetingHappened: true,
      rating: null,
      nextStep: 'RATE',
    });
  });

  it('maps rating fields, defaults isPublic to true unless explicitly false, and filters unknown next_step tokens', () => {
    expect(
      mapReservationFeedbackDto({
        meeting_happened: true,
        rating: fromPartial<RawReservationRating>({
          rating: 9,
          content: '具體且實用的回饋',
          created_at: 1760000100,
          updated_at: 1760000200,
          author_name: '陳**',
        }),
        next_step: fromAny('UNKNOWN_STEP'),
      })
    ).toEqual({
      meetingHappened: true,
      myMeetingHappened: true,
      rating: {
        rating: 9,
        content: '具體且實用的回饋',
        createdAt: 1760000100,
        updatedAt: 1760000200,
        authorName: '陳**',
        isPublic: true,
      },
      nextStep: null,
    });

    expect(
      mapReservationFeedbackDto({
        meeting_happened: false,
        my_meeting_happened: true,
        rating: fromPartial<RawReservationRating>({
          rating: 8,
          content: '未公開評論',
          is_public: false,
        }),
        next_step: null,
      })
    ).toEqual({
      meetingHappened: false,
      myMeetingHappened: true,
      rating: {
        rating: 8,
        content: '未公開評論',
        createdAt: 0,
        updatedAt: 0,
        authorName: null,
        isPublic: false,
      },
      nextStep: null,
    });
  });

  it('normalizes counterpart display fields, party IDs, and cancelled_by tokens', () => {
    expect(
      normalizeFeedbackCounterpartDto({
        counterpart: {
          user_id: 42,
          name: '  Zahra Mirzakhani ',
          avatar: '   ',
          job_title: 'Staff UX Researcher',
          company: '',
          years_of_experience: 'FIVE_TO_TEN',
        },
      })
    ).toEqual({
      name: 'Zahra Mirzakhani',
      avatar: undefined,
      roleLine: 'Staff UX Researcher, 5~10 年',
      counterpartyUserId: 42,
    });

    expect(resolveFeedbackPartyIds('10', 42, 'MENTEE')).toEqual({
      senderUserId: 10,
      participantUserId: 42,
    });
    expect(resolveFeedbackPartyIds('10', 42, 'MENTOR')).toEqual({
      senderUserId: 42,
      participantUserId: 10,
    });

    expect(normalizeCancelledByDto('SYSTEM')).toBe('SYSTEM');
    expect(normalizeCancelledByDto('INVALID')).toBeUndefined();
    expect(normalizeCancelledByDto(null)).toBeUndefined();
  });

  it('extracts backend mutation flags from flat and nested feedback envelopes', () => {
    expect(
      extractBackendIsPublic({ feedback: { rating: { is_public: false } } })
    ).toBe(false);
    expect(extractBackendIsPublic({ is_public: true })).toBe(true);
    expect(extractBackendIsPublic(null)).toBeUndefined();

    expect(
      extractBackendMeetingHappened({ feedback: { meeting_happened: false } })
    ).toBe(false);
    expect(extractBackendMeetingHappened({})).toBeUndefined();

    expect(
      extractBackendMyMeetingHappened({
        feedback: { my_meeting_happened: true },
      })
    ).toBe(true);
    expect(
      extractBackendMyMeetingHappened({
        feedback: { my_meeting_happened: null },
      })
    ).toBeNull();
    expect(extractBackendMyMeetingHappened({})).toBeUndefined();
  });
});

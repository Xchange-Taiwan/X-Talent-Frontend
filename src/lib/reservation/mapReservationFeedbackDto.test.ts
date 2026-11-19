import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import type { RawReservationRating } from '@/types/reservationFeedback';

import {
  extractBackendIsPublic,
  extractBackendMeetingHappened,
  extractBackendMyMeetingHappened,
  mapReservationFeedbackDto,
  normalizeCancelledByDto,
  normalizeFeedbackCandidateDto,
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

  it('normalizes feedback candidate DTOs consistently across pending-queue and single-lookup shapes (#944)', () => {
    expect(normalizeFeedbackCandidateDto(null, '10')).toBeNull();
    expect(
      normalizeFeedbackCandidateDto(
        { id: '   ', dtstart: 100, dtend: 200 },
        '10'
      )
    ).toBeNull();

    const singleCandidate = normalizeFeedbackCandidateDto(
      {
        reservation_id: 205,
        id: 999,
        role: 'mentor',
        dtstart: 1760958000,
        dtend: Number.NaN,
        schedule_id: 44,
        version: 3,
        cancelled_by: 'SYSTEM',
        counterpart: {
          user_id: 88,
          name: '  林學員  ',
          avatar: '   ',
          job_title: '前端工程師',
          company: 'AppWorks',
        },
        feedback: {
          next_step: 'ANSWER',
          meeting_happened: null,
          rating: null,
        },
      },
      '2',
      {
        fallbackViewerRole: 'MENTEE',
        preferReservationId: true,
        preferRoleField: true,
      }
    );

    expect(singleCandidate).toEqual({
      id: '205',
      name: '林學員',
      avatar: undefined,
      roleLine: '前端工程師, AppWorks',
      counterpartyUserId: 88,
      senderUserId: 88,
      participantUserId: 2,
      dtstart: 1760958000,
      dtend: 1760958000,
      scheduleId: 44,
      version: 3,
      viewerRole: 'MENTOR',
      cancelledBy: 'SYSTEM',
      feedback: {
        nextStep: 'ANSWER',
        meetingHappened: null,
        myMeetingHappened: null,
        rating: null,
      },
    });
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

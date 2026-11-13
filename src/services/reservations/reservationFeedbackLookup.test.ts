import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiError } from '@/lib/apiClient';

import {
  fetchSingleReservationFeedback,
  mapSingleReservationFeedbackLookup,
} from './reservationFeedbackLookup';

vi.mock('@/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getUnwrapped: vi.fn(),
    },
  };
});

const mockGetUnwrapped = vi.mocked(apiClient.getUnwrapped);

describe('reservationFeedbackLookup (#875 / #760 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps MENTOR and MENTEE single-reservation responses and normalizes empty avatar "" to undefined', () => {
    const mentorLookup = mapSingleReservationFeedbackLookup(
      {
        reservation_id: 205,
        role: 'MENTOR',
        counterpart: {
          name: '林學員',
          avatar: '',
          job_title: '前端工程師',
          company: 'AppWorks',
        },
        dtstart: 1760958000,
        dtend: 1760959800,
        cancelled_by: null,
        feedback: {
          next_step: 'ANSWER',
          meeting_happened: null,
          rating: null,
        },
      },
      '2',
      'mentee'
    );

    expect(mentorLookup).not.toBeNull();
    expect(mentorLookup?.viewerRole).toBe('mentor');
    expect(mentorLookup?.reservation).toMatchObject({
      id: '205',
      name: '林學員',
      avatar: undefined,
      roleLine: '前端工程師, AppWorks',
      viewerRole: 'MENTOR',
      feedback: {
        nextStep: 'ANSWER',
        meetingHappened: null,
        rating: null,
      },
    });

    const menteeLookup = mapSingleReservationFeedbackLookup(
      {
        reservation_id: 108,
        role: 'MENTEE',
        counterpart: {
          name: 'Emily Chen',
          avatar: 'https://cdn.example.com/emily.png',
          job_title: 'Senior UX Designer',
          company: 'Google Taiwan',
        },
        dtstart: 1760958000,
        dtend: 1760959800,
        cancelled_by: null,
        feedback: {
          next_step: null,
          meeting_happened: true,
          rating: {
            rating: 10,
            content: '非常實用的職涯建議',
            created_at: 1760960000,
            updated_at: 1760960000,
            author_name: '王＊明',
            is_public: true,
          },
        },
      },
      '1',
      'mentor'
    );

    expect(menteeLookup?.viewerRole).toBe('mentee');
    expect(menteeLookup?.reservation).toMatchObject({
      id: '108',
      name: 'Emily Chen',
      avatar: 'https://cdn.example.com/emily.png',
      roleLine: 'Senior UX Designer, Google Taiwan',
      viewerRole: 'MENTEE',
    });
  });

  it('calls GET /v1/users/:userId/reservations/:reservationId/feedback and returns null on 404', async () => {
    mockGetUnwrapped.mockResolvedValueOnce({
      reservation_id: 301,
      role: 'MENTOR',
      counterpart: {
        name: '王小明',
        avatar: '   ',
        job_title: 'PM',
        company: '',
      },
      dtstart: 1760958000,
      dtend: 1760959800,
      cancelled_by: null,
      feedback: {
        next_step: 'ANSWER',
        meeting_happened: null,
        rating: null,
      },
    });

    const found = await fetchSingleReservationFeedback({
      userId: '2',
      reservationId: '301',
    });
    expect(mockGetUnwrapped).toHaveBeenCalledWith(
      '/v1/users/2/reservations/301/feedback',
      { signal: undefined }
    );
    expect(found?.viewerRole).toBe('mentor');
    expect(found?.reservation.avatar).toBeUndefined();

    mockGetUnwrapped.mockRejectedValueOnce(new ApiError(404, 'Not found'));
    const missing = await fetchSingleReservationFeedback({
      userId: '2',
      reservationId: '999',
    });
    expect(missing).toBeNull();
  });
});

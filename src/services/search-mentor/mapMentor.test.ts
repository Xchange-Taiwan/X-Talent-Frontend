import { describe, expect, it } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import type { MentorType } from '@/types/mentor';

import {
  mapMentor,
  mapMentorPage,
  mapMentorStats,
  type RawMentor,
  resolveMentorAvatar,
} from './mapMentor';

function createRawMentor(
  overrides: Partial<RawMentor> & { user_id: number }
): RawMentor {
  return {
    user_id: overrides.user_id,
    name: overrides.name !== undefined ? overrides.name : null,
    avatar: overrides.avatar !== undefined ? overrides.avatar : null,
    job_title: overrides.job_title !== undefined ? overrides.job_title : null,
    company: overrides.company !== undefined ? overrides.company : null,
    years_of_experience:
      overrides.years_of_experience !== undefined
        ? overrides.years_of_experience
        : null,
    location: overrides.location !== undefined ? overrides.location : null,
    industry: overrides.industry !== undefined ? overrides.industry : undefined,
    onboarding:
      overrides.onboarding !== undefined ? overrides.onboarding : false,
    is_mentor: overrides.is_mentor !== undefined ? overrides.is_mentor : true,
    language: overrides.language !== undefined ? overrides.language : 'zh_TW',
    personal_statement:
      overrides.personal_statement !== undefined
        ? overrides.personal_statement
        : null,
    about: overrides.about !== undefined ? overrides.about : null,
    seniority_level:
      overrides.seniority_level !== undefined
        ? overrides.seniority_level
        : null,
    want_position:
      overrides.want_position !== undefined ? overrides.want_position : null,
    want_skill:
      overrides.want_skill !== undefined ? overrides.want_skill : null,
    want_topic:
      overrides.want_topic !== undefined ? overrides.want_topic : null,
    have_skill:
      overrides.have_skill !== undefined ? overrides.have_skill : null,
    have_topic:
      overrides.have_topic !== undefined ? overrides.have_topic : null,
    updated_at:
      overrides.updated_at !== undefined ? overrides.updated_at : null,
    views: overrides.views !== undefined ? overrides.views : 0,
    stats: overrides.stats,
    completed_meeting_count: overrides.completed_meeting_count,
    total_rating_count: overrides.total_rating_count,
    rating_count: overrides.rating_count,
    rating_average: overrides.rating_average,
  };
}

describe('mapMentor', () => {
  it('correctly maps raw mentor response to MentorType', () => {
    const raw = createRawMentor({
      user_id: 123,
      name: 'John Doe',
      avatar: 'https://example.com/avatar.jpg',
      job_title: 'Software Engineer',
      company: 'Tech Corp',
      years_of_experience: '3_5',
      location: 'Taiwan',
      personal_statement: 'Hello',
      about: 'About me',
      seniority_level: 'SENIOR',
      want_position: ['engineer'],
      want_skill: ['typescript'],
      want_topic: ['react'],
      have_skill: ['nodejs'],
      have_topic: ['topic_a', 'topic_b'],
      updated_at: '2021-01-07T06:13:20Z',
    });

    const mapped = mapMentor(raw);

    expect(mapped).toEqual({
      user_id: 123,
      name: 'John Doe',
      avatar: 'https://example.com/avatar.jpg?cb=2021-01-07T06%3A13%3A20Z',
      job_title: 'Software Engineer',
      company: 'Tech Corp',
      years_of_experience: '3_5',
      location: 'Taiwan',
      personal_statement: 'Hello',
      about: 'About me',
      seniority_level: 'SENIOR',
      industry: null,
      want_position: ['engineer'],
      want_skill: ['typescript'],
      want_topic: ['react'],
      have_skill: ['nodejs'],
      have_topic: ['topic_a', 'topic_b'],
      updated_at: '2021-01-07T06:13:20Z',
      stats: null,
    });
  });

  it('handles null and field omissions gracefully in mapMentor', () => {
    const raw = createRawMentor({
      user_id: 456,
    });

    const mapped = mapMentor(raw);

    expect(mapped).toEqual({
      user_id: 456,
      name: '',
      avatar: avatarImage,
      job_title: '',
      company: '',
      years_of_experience: '',
      location: '',
      personal_statement: '',
      about: '',
      seniority_level: '',
      industry: null,
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: [],
      have_topic: [],
      updated_at: null,
      stats: null,
    });
  });

  it('maps optional stats using total_rating_count (#760) with fallback to legacy rating_count and handles 0 ratings (#737)', () => {
    const withTotalRatingCount = mapMentor(
      createRawMentor({
        user_id: 501,
        stats: {
          completed_meeting_count: 12,
          total_rating_count: 8,
          rating_average: 9.8,
        },
      })
    );
    expect(withTotalRatingCount.stats).toEqual({
      completed_meeting_count: 12,
      rating_count: 8,
      rating_average: 9.8,
    });

    const zeroTotalRatingCount = mapMentor(
      createRawMentor({
        user_id: 502,
        stats: {
          completed_meeting_count: 3,
          total_rating_count: 0,
          rating_average: 9.5,
        },
      })
    );
    expect(zeroTotalRatingCount.stats).toEqual({
      completed_meeting_count: 3,
      rating_count: 0,
      rating_average: null,
    });

    const prefersTotalOverLegacy = mapMentor(
      createRawMentor({
        user_id: 503,
        stats: {
          completed_meeting_count: 10,
          total_rating_count: 15,
          rating_count: 8,
          rating_average: 9.7,
        },
      })
    );
    expect(prefersTotalOverLegacy.stats).toEqual({
      completed_meeting_count: 10,
      rating_count: 15,
      rating_average: 9.7,
    });

    const prefersZeroTotalOverLegacyPositive = mapMentor(
      createRawMentor({
        user_id: 504,
        stats: {
          completed_meeting_count: 4,
          total_rating_count: 0,
          rating_count: 6,
          rating_average: 9.4,
        },
      })
    );
    expect(prefersZeroTotalOverLegacyPositive.stats).toEqual({
      completed_meeting_count: 4,
      rating_count: 0,
      rating_average: null,
    });

    const fallsBackWhenTotalNullOrUndefined = mapMentor(
      createRawMentor({
        user_id: 505,
        stats: {
          completed_meeting_count: 9,
          total_rating_count: null,
          rating_count: 7,
          rating_average: 9.3,
        },
      })
    );
    expect(fallsBackWhenTotalNullOrUndefined.stats).toEqual({
      completed_meeting_count: 9,
      rating_count: 7,
      rating_average: 9.3,
    });
  });

  it('normalizes invalid or flat top-level stats fields safely in mapMentorStats', () => {
    expect(mapMentorStats(createRawMentor({ user_id: 601, stats: null }))).toBe(
      null
    );

    expect(
      mapMentorStats(
        createRawMentor({
          user_id: 602,
          stats: {
            completed_meeting_count: -4,
            total_rating_count: Number.NaN,
            rating_average: 0,
          },
        })
      )
    ).toEqual({
      completed_meeting_count: 0,
      rating_count: 0,
      rating_average: null,
    });

    expect(
      mapMentorStats(
        createRawMentor({
          user_id: 603,
          completed_meeting_count: 15,
          rating_count: 10,
          rating_average: 9.6,
        })
      )
    ).toEqual({
      completed_meeting_count: 15,
      rating_count: 10,
      rating_average: 9.6,
    });

    expect(
      mapMentorStats(
        createRawMentor({
          user_id: 604,
          completed_meeting_count: 20,
          total_rating_count: 14,
          rating_count: 9,
          rating_average: 9.9,
        })
      )
    ).toEqual({
      completed_meeting_count: 20,
      rating_count: 14,
      rating_average: 9.9,
    });
  });

  it('combines resolveMentorAvatar behavior inside mapMentor', () => {
    // 1. empty avatar falls back to default image
    const rawNoAvatar = createRawMentor({ user_id: 777, avatar: null });
    const mappedNoAvatar = mapMentor(rawNoAvatar);
    expect(mappedNoAvatar.avatar).toBe(avatarImage);

    // 2. presence of avatar without updated_at does not cache-bust
    const rawNoUpdated = createRawMentor({
      user_id: 888,
      avatar: 'https://example.com/avatar.jpg',
      updated_at: null,
    });
    const mappedNoUpdated = mapMentor(rawNoUpdated);
    expect(mappedNoUpdated.avatar).toBe('https://example.com/avatar.jpg');

    // 3. presence of avatar with updated_at applies cache-busting
    const rawWithUpdated = createRawMentor({
      user_id: 999,
      avatar: 'https://example.com/avatar.jpg',
      updated_at: '2021-05-03T00:00:00Z',
    });
    const mappedWithUpdated = mapMentor(rawWithUpdated);
    expect(mappedWithUpdated.avatar).toBe(
      'https://example.com/avatar.jpg?cb=2021-05-03T00%3A00%3A00Z'
    );
  });
});

describe('resolveMentorAvatar', () => {
  const baseMentor: MentorType = {
    user_id: 123,
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
    job_title: 'Software Engineer',
    company: 'Tech Corp',
    years_of_experience: '3_5',
    location: 'Taiwan',
    personal_statement: 'Hello',
    about: 'About me',
    seniority_level: 'Senior',
    industry: 'technology',
    want_position: ['engineer'],
    want_skill: ['typescript'],
    want_topic: ['react'],
    have_skill: ['nodejs'],
    have_topic: ['topic_a', 'topic_b'],
    updated_at: '2021-01-07T06:13:20Z',
  };

  it('applies avatar cache-busting when updated_at is present', () => {
    const resolved = resolveMentorAvatar(baseMentor);
    expect(resolved.avatar).toBe(
      'https://example.com/avatar.jpg?cb=2021-01-07T06%3A13%3A20Z'
    );
  });

  it('does not apply avatar cache-busting when updated_at is null', () => {
    const mentor = { ...baseMentor, updated_at: null };
    const resolved = resolveMentorAvatar(mentor);
    expect(resolved.avatar).toBe('https://example.com/avatar.jpg');
  });

  it('falls back to default avatar image when avatar is empty', () => {
    const mentor = { ...baseMentor, avatar: '' };
    const resolved = resolveMentorAvatar(mentor);
    expect(resolved.avatar).toBe(avatarImage);
  });
});

describe('mapMentorPage', () => {
  it('maps mentors array and preserves non-empty next_cursor', () => {
    const page = mapMentorPage({
      mentors: [createRawMentor({ user_id: 10, name: 'Alice' })],
      next_cursor: 'cursor-token-1',
    });

    expect(page.mentors).toHaveLength(1);
    expect(page.mentors[0].user_id).toBe(10);
    expect(page.mentors[0].name).toBe('Alice');
    expect(page.nextCursor).toBe('cursor-token-1');
  });

  it('normalizes empty string, null, or omitted next_cursor to null and handles nullish data', () => {
    expect(mapMentorPage()).toEqual({ mentors: [], nextCursor: null });
    expect(mapMentorPage(null)).toEqual({ mentors: [], nextCursor: null });
    expect(
      mapMentorPage({
        mentors: [createRawMentor({ user_id: 11 })],
        next_cursor: '',
      }).nextCursor
    ).toBeNull();
  });
});

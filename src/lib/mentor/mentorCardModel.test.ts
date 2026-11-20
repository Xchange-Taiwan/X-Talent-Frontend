import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import avatarImage from '@/assets/default-avatar.png';
import {
  buildMentorCardTags,
  formatCompletedMeetings,
  formatMentorRating,
  normalizeMentorFromProfile,
  projectMentorCard,
  resolveMentorAvatar,
} from '@/lib/mentor/mentorCardModel';
import { projectUserProfile } from '@/lib/profile/profileProjection';
import { mapMentor, type RawMentor } from '@/services/search-mentor/mapMentor';
import type { MentorType } from '@/types/mentor';
import type { MentorProfileVO, UserType } from '@/types/user';

const CATALOG_LABEL_MAP = new Map<string, string>([
  ['topic_career', '職涯諮詢'],
  ['topic_portfolio', '作品集健檢'],
  ['topic_react', 'React'],
  ['skill_figma', 'Figma'],
  ['skill_typescript', 'TypeScript'],
  ['skill_react', 'React'],
]);

function buildRawWireMentor(overrides: Partial<RawMentor> = {}): RawMentor {
  return fromPartial<RawMentor>({
    user_id: 777,
    name: 'Zahra Mirzakhani',
    avatar: 'https://cdn.example.com/mentors/777/avatar.jpg',
    job_title: 'Senior UX Designer',
    company: 'CreativeUX Design Studio',
    years_of_experience: 'FIVE_TO_TEN',
    location: 'TWN',
    personal_statement: '歡迎帶著作品集來交流。',
    about: '超過七年數位產品設計與跨產品設計系統經驗。',
    seniority_level: 'SENIOR',
    industry: fromAny('DESIGN'),
    want_position: ['product_designer'],
    want_skill: ['skill_typescript'],
    want_topic: ['topic_career'],
    have_skill: ['skill_figma', 'skill_typescript'],
    have_topic: ['topic_portfolio', 'topic_career'],
    updated_at: '2026-11-15T08:00:00Z',
    stats: {
      completed_meeting_count: 18,
      rating_count: 12,
      rating_average: 9.76,
    },
    ...overrides,
  });
}

function buildProfileUserData(overrides: Partial<UserType> = {}): UserType {
  const projected = projectUserProfile(
    fromPartial<MentorProfileVO>({
      user_id: 777,
      name: 'Zahra Mirzakhani',
      avatar: 'https://cdn.example.com/mentors/777/avatar.jpg',
      job_title: 'Senior UX Designer',
      company: 'CreativeUX Design Studio',
      is_mentor: true,
      about: '超過七年數位產品設計與跨產品設計系統經驗。',
      personal_statement: '歡迎帶著作品集來交流。',
      years_of_experience: 'FIVE_TO_TEN',
      seniority_level: 'SENIOR',
      location: 'TWN',
      industry: fromAny({
        subject_group: 'DESIGN',
        subject: '設計及創意相關業',
      }),
      updated_at: '2026-11-15T08:00:00Z',
      stats: {
        completed_meeting_count: 18,
        rating_count: 12,
        rating_average: 9.76,
      },
      want_position: ['product_designer'],
      want_skill: ['skill_typescript'],
      want_topic: ['topic_career'],
      have_skill: ['skill_figma', 'skill_typescript'],
      have_topic: ['topic_portfolio', 'topic_career'],
    }),
    {
      labelMap: new Map([
        ['DESIGN', '設計及創意相關業'],
        ['product_designer', '產品設計師'],
        ['skill_typescript', 'TypeScript'],
        ['topic_career', '職涯諮詢'],
        ['skill_figma', 'Figma'],
        ['topic_portfolio', '作品集健檢'],
      ]),
      language: 'zh_TW',
    }
  );

  return {
    ...projected,
    ...overrides,
  };
}

describe('mentorCardModel (#896)', () => {
  describe('wire RawMentor vs profile UserType normalization invariants', () => {
    it('produces identical MentorType and MentorCardViewModel for custom-photo mentors with ?cb= cache-busting and raw subject_group codes', () => {
      const fromWire = mapMentor(buildRawWireMentor());
      const fromProfile = normalizeMentorFromProfile(buildProfileUserData());

      expect(fromProfile).toEqual(fromWire);
      expect(fromProfile.avatar).toBe(
        'https://cdn.example.com/mentors/777/avatar.jpg?cb=2026-11-15T08%3A00%3A00Z'
      );
      expect(fromProfile.have_topic).toEqual([
        'topic_portfolio',
        'topic_career',
      ]);
      expect(fromProfile.have_skill).toEqual([
        'skill_figma',
        'skill_typescript',
      ]);
      expect(fromProfile.want_position).toEqual(['product_designer']);
      expect(fromProfile.industry).toBe('DESIGN');
      expect(fromProfile.years_of_experience).toBe('FIVE_TO_TEN');

      const options = {
        labelMap: CATALOG_LABEL_MAP,
        prioritizedCodes: new Set(['skill_typescript']),
      };
      expect(projectMentorCard(fromProfile, options)).toEqual(
        projectMentorCard(fromWire, options)
      );
    });

    it('produces identical non-empty fallback avatar when wire avatar is null and profile avatar is empty string', () => {
      const fromWire = mapMentor(
        buildRawWireMentor({ avatar: null, updated_at: null })
      );
      const fromProfile = normalizeMentorFromProfile(
        buildProfileUserData({ avatar: '', updated_at: null })
      );

      expect(fromProfile).toEqual(fromWire);
      expect(fromProfile.avatar).toBe(avatarImage);

      const projected = projectMentorCard(fromProfile, {
        labelMap: CATALOG_LABEL_MAP,
      });
      expect(projected.avatar).toBe(avatarImage);
      expect(projected.tags).toEqual([
        '作品集健檢',
        '職涯諮詢',
        'Figma',
        'TypeScript',
      ]);
    });

    it('produces identical 0-rating suppression across wire RawMentor and profile UserType', () => {
      const zeroRatedStats = {
        completed_meeting_count: 5,
        rating_count: 0,
        rating_average: 9.4,
      };
      const fromWire = mapMentor(buildRawWireMentor({ stats: zeroRatedStats }));
      const fromProfile = normalizeMentorFromProfile(
        buildProfileUserData({ stats: zeroRatedStats })
      );

      expect(fromProfile.stats).toEqual({
        completed_meeting_count: 5,
        rating_count: 0,
        rating_average: null,
      });
      expect(fromProfile).toEqual(fromWire);

      const projected = projectMentorCard(fromProfile);
      expect(projected.ratingLabel).toBeNull();
      expect(projected.completedMeetingsLabel).toBe('已完成 5 場 1-on-1');
    });

    it('appends &cb= cleanly when profile avatar already carries a write-time ?v= parameter', () => {
      const normalized = normalizeMentorFromProfile(
        buildProfileUserData({
          avatar: 'https://s3.example.com/files/777/avatar?v=1754000000000',
          updated_at: '2026-11-15T09:30:00Z',
        })
      );

      expect(normalized.avatar).toBe(
        'https://s3.example.com/files/777/avatar?v=1754000000000&cb=2026-11-15T09%3A30%3A00Z'
      );
    });

    it('preserves null industry when profile has no primary industry even if work experiences carry industry entries', () => {
      const normalized = normalizeMentorFromProfile(
        buildProfileUserData({
          industry: undefined,
          industries: [{ subject_group: 'SOFTWARE', subject: '軟體及網路業' }],
        })
      );

      expect(normalized.industry).toBeNull();
    });

    it('falls back safely when legacy callers pass hand-crafted display strings without raw *_code fields (#945)', () => {
      const legacyUser: UserType = {
        user_id: 888,
        name: 'Legacy Fixture Mentor',
        avatar: '',
        job_title: 'Principal Engineer',
        company: 'Acme',
        is_mentor: true,
        years_of_experience: '5~10 年',
        location: '台灣',
        industry: '設計及創意相關業',
        want_position: [],
        want_skill: [],
        want_topic: [],
        have_skill: [{ subject_group: 'skill_typescript', subject: 'TS' }],
        have_topic: [{ subject_group: 'topic_career', subject: 'Career' }],
      };

      const normalized = normalizeMentorFromProfile(legacyUser);
      expect(normalized.years_of_experience).toBe('5~10 年');
      expect(normalized.location).toBe('台灣');
      expect(normalized.industry).toBe('設計及創意相關業');

      const card = projectMentorCard(normalized, {
        labelMap: CATALOG_LABEL_MAP,
      });
      expect(card.yearsOfExperienceLabel).toBe('5~10 年');
      expect(card.tags).toEqual(['職涯諮詢', 'TypeScript']);
    });
  });

  describe('resolveMentorAvatar', () => {
    it('returns the exact same MentorType reference when avatar is already normalized', () => {
      const alreadyNormalized = normalizeMentorFromProfile(
        buildProfileUserData()
      );
      expect(resolveMentorAvatar(alreadyNormalized)).toBe(alreadyNormalized);

      const fallbackMentor = normalizeMentorFromProfile(
        buildProfileUserData({ avatar: '' })
      );
      expect(fallbackMentor.avatar).toBe(avatarImage);
      expect(resolveMentorAvatar(fallbackMentor)).toBe(fallbackMentor);
      expect(projectMentorCard(fallbackMentor).avatar).toBe(avatarImage);
    });

    it('falls back to default avatar when avatar is whitespace-only', () => {
      const mentor = fromPartial<MentorType>({
        user_id: 1,
        avatar: '   ',
        updated_at: '2026-11-15T00:00:00Z',
      });
      expect(resolveMentorAvatar(mentor).avatar).toBe(avatarImage);
    });
  });

  describe('projectMentorCard', () => {
    it('projects localized tags, experience badge, and rating/meeting labels without mutating raw subject_group codes on mentorSnapshot', () => {
      const mentor = fromPartial<MentorType>({
        user_id: 42,
        name: '林冠宇 Alex',
        avatar: '',
        job_title: 'Staff Engineer',
        company: 'Acme Cloud',
        years_of_experience: 'OVER_TEN_YEAR',
        about: '大型分散式系統架構與職涯規劃。',
        have_topic: ['topic_career', 'topic_react'],
        have_skill: ['skill_react', 'skill_typescript'],
        updated_at: '2026-11-15T10:00:00Z',
        stats: {
          completed_meeting_count: 14,
          rating_count: 6,
          rating_average: 9.84,
        },
      });

      const viewModel = projectMentorCard(mentor, {
        labelMap: CATALOG_LABEL_MAP,
        prioritizedCodes: new Set(['skill_typescript']),
      });

      expect(viewModel).toEqual({
        id: 42,
        name: '林冠宇 Alex',
        avatar: avatarImage,
        yearsOfExperienceLabel: '10 年以上',
        jobTitle: 'Staff Engineer',
        company: 'Acme Cloud',
        about: '大型分散式系統架構與職涯規劃。',
        tags: ['TypeScript', '職涯諮詢', 'React'],
        ratingLabel: '9.8 / 10',
        completedMeetingsLabel: '已完成 14 場 1-on-1',
        mentorSnapshot: expect.objectContaining({
          user_id: 42,
          avatar: avatarImage,
          have_topic: ['topic_career', 'topic_react'],
          have_skill: ['skill_react', 'skill_typescript'],
        }),
      });
    });

    it('suppresses ratingLabel when unnormalized MentorType has rating_count === 0 alongside non-null rating_average', () => {
      const unnormalizedMentor = fromPartial<MentorType>({
        user_id: 88,
        name: 'New Mentor',
        avatar: avatarImage,
        years_of_experience: 'ONE_TO_THREE',
        job_title: 'Engineer',
        company: 'Co',
        about: 'Bio',
        have_topic: [],
        have_skill: [],
        stats: {
          completed_meeting_count: 2,
          rating_count: 0,
          rating_average: 9.5,
        },
      });

      const viewModel = projectMentorCard(unnormalizedMentor);
      expect(viewModel.ratingLabel).toBeNull();
      expect(viewModel.completedMeetingsLabel).toBe('已完成 2 場 1-on-1');
    });
  });

  describe('buildMentorCardTags, formatMentorRating, and formatCompletedMeetings', () => {
    it('merges have_topic before have_skill, prioritizes matched raw codes, and deduplicates resolved labels', () => {
      expect(
        buildMentorCardTags(
          {
            have_topic: ['topic_career', 'topic_react'],
            have_skill: ['skill_react', 'skill_figma', 'custom_code'],
          },
          new Set(['skill_figma']),
          CATALOG_LABEL_MAP
        )
      ).toEqual(['Figma', '職涯諮詢', 'React', 'custom_code']);
    });

    it('formats mentor rating using mentorStats formatRatingScoreValue and suppresses 0-count ratings', () => {
      expect(formatMentorRating(9)).toBe('9.0 / 10');
      expect(formatMentorRating(8.55)).toBe('8.6 / 10');
      expect(formatMentorRating(10, 3)).toBe('10.0 / 10');
      expect(formatMentorRating(9.5, 0)).toBeNull();
      expect(formatMentorRating(9.5, -2)).toBeNull();
      expect(formatMentorRating(0)).toBeNull();
      expect(formatMentorRating(-2)).toBeNull();
      expect(formatMentorRating(null)).toBeNull();
      expect(formatMentorRating(undefined)).toBeNull();
      expect(formatMentorRating(Number.NaN)).toBeNull();
    });

    it('formats completed meetings using mentorStats toNonNegativeInt', () => {
      expect(formatCompletedMeetings(12)).toBe('已完成 12 場 1-on-1');
      expect(formatCompletedMeetings(12.9)).toBe('已完成 12 場 1-on-1');
      expect(formatCompletedMeetings(0.4)).toBeNull();
      expect(formatCompletedMeetings(0)).toBeNull();
      expect(formatCompletedMeetings(-1)).toBeNull();
      expect(formatCompletedMeetings(null)).toBeNull();
      expect(formatCompletedMeetings(undefined)).toBeNull();
    });
  });
});

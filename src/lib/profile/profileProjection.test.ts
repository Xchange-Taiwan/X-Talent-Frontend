import { fromAny, fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import { ExperienceType } from '@/services/profile/experienceType';
import { EMPTY_TAG_CATALOGS } from '@/services/profile/tagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';
import type { MentorProfileVO, UserType } from '@/types/user';

import {
  deriveProfilePageViewModel,
  normalizePersonalLinks,
  projectUserProfile,
} from './profileProjection';

function buildBaseDto(
  overrides: Partial<MentorProfileVO> = {}
): MentorProfileVO {
  return fromPartial<MentorProfileVO>({
    user_id: 777,
    name: 'Zahra Mirzakhani',
    avatar: 'https://cdn.example.com/mentors/777/avatar.jpg',
    job_title: 'Top-Level Fallback Title',
    company: 'Top-Level Fallback Co',
    years_of_experience: 'FIVE_TO_TEN',
    location: 'TWN',
    industry: fromAny({
      id: 1,
      subject_group: 'DESIGN',
      subject: '設計及創意相關業',
    }),
    is_mentor: true,
    personal_statement: '歡迎帶著作品集來交流。',
    about: '超過七年數位產品設計經驗。',
    seniority_level: 'SENIOR',
    updated_at: '2026-11-15T08:00:00Z',
    experiences: [],
    want_position: ['product_designer'],
    want_skill: ['skill_typescript'],
    want_topic: ['topic_career'],
    have_skill: ['skill_figma', 'skill_unknown'],
    have_topic: ['topic_portfolio'],
    stats: {
      completed_meeting_count: 18,
      rating_count: 12,
      rating_average: 9.76,
    },
    ...overrides,
  });
}

const SAMPLE_CATALOGS: TagCatalogsByBucket = {
  ...EMPTY_TAG_CATALOGS,
  industry: [
    { subject_group: 'DESIGN', subject: '設計及創意相關業' },
    { subject_group: 'SOFTWARE', subject: '軟體及網路相關業' },
  ],
  want_position: [
    fromPartial({
      leaves: [{ subject_group: 'product_designer', subject: '產品設計師' }],
    }),
  ],
  want_skill: [
    fromPartial({
      leaves: [{ subject_group: 'skill_typescript', subject: 'TypeScript' }],
    }),
  ],
  want_topic: [
    fromPartial({
      leaves: [{ subject_group: 'topic_career', subject: '職涯諮詢' }],
    }),
  ],
  have_skill: [
    fromPartial({
      leaves: [{ subject_group: 'skill_figma', subject: 'Figma' }],
    }),
  ],
  have_topic: [
    fromPartial({
      leaves: [{ subject_group: 'topic_portfolio', subject: '作品集健檢' }],
    }),
  ],
};

describe('profileProjection (#945)', () => {
  describe('normalizePersonalLinks', () => {
    it('normalizes casing/HTTPS, enforces platform host allowlists, deduplicates with first-seen valid link wins, and outputs canonical platform order', () => {
      const normalized = normalizePersonalLinks([
        { platform: 'website', url: 'example.com' },
        { platform: 'website', url: 'https://second-site.example.com' },
        { platform: 'linkedin', url: 'https://evil-linkedin.com/in/attacker' },
        { platform: '  LinkedIn ', url: 'https://linkedin.com/in/first-valid' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/in/duplicate' },
        { platform: 'GitHub', url: 'https://gitlab.com/imposter' },
        { platform: 'GitHub', url: 'github.com/first-octocat' },
        { platform: 'github', url: 'https://github.com/second-octocat' },
        { platform: 'twitter', url: 'http://x.com/insecure-http' },
        { platform: 'facebook', url: 'javascript:alert(1)' },
        { platform: 'facebook', url: 'https://facebook.com/valid-fb' },
        { platform: 'unknown', url: 'https://example.com' },
      ]);

      expect(normalized).toEqual([
        { platform: 'linkedin', url: 'https://linkedin.com/in/first-valid' },
        { platform: 'facebook', url: 'https://facebook.com/valid-fb' },
        { platform: 'github', url: 'https://github.com/first-octocat' },
        { platform: 'website', url: 'https://example.com' },
      ]);
    });

    it('returns an empty array for null, undefined, or empty inputs', () => {
      expect(normalizePersonalLinks(null)).toEqual([]);
      expect(normalizePersonalLinks(undefined)).toEqual([]);
      expect(normalizePersonalLinks([])).toEqual([]);
    });
  });

  describe('projectUserProfile', () => {
    it('preserves both raw wire codes and localized display labels across seniority, location, industry, and tag buckets', () => {
      const projected = projectUserProfile(buildBaseDto(), {
        catalogs: SAMPLE_CATALOGS,
        language: 'zh_TW',
      });

      expect(projected.years_of_experience_code).toBe('FIVE_TO_TEN');
      expect(projected.years_of_experience).toBe('5~10 年');

      expect(projected.location_code).toBe('TWN');
      expect(projected.location).toBe('台灣');

      expect(projected.industry_code).toBe('DESIGN');
      expect(projected.industry).toBe('設計及創意相關業');
      expect(projected.industries).toEqual([
        { subject_group: 'DESIGN', subject: '設計及創意相關業' },
      ]);

      expect(projected.want_position).toEqual([
        { subject_group: 'product_designer', subject: '產品設計師' },
      ]);
      expect(projected.have_skill).toEqual([
        { subject_group: 'skill_figma', subject: 'Figma' },
        { subject_group: 'skill_unknown', subject: 'skill_unknown' },
      ]);
      expect(projected.have_topic).toEqual([
        { subject_group: 'topic_portfolio', subject: '作品集健檢' },
      ]);
      expect(projected.updated_at).toBe('2026-11-15T08:00:00Z');
      expect(projected.stats).toEqual({
        completed_meeting_count: 18,
        rating_count: 12,
        rating_average: 9.76,
      });
    });

    it('unifies job_title and company resolution: prefers is_primary work experience, falls back to first work experience, and falls back to top-level fields only when no WORK experience exists', () => {
      // 1. Primary work experience wins over top-level fields
      const withPrimary = projectUserProfile(
        buildBaseDto({
          job_title: 'Stale Top Title',
          company: 'Stale Top Co',
          experiences: fromAny([
            {
              category: ExperienceType.WORK,
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  {
                    job: 'Secondary Role',
                    company: 'Secondary Co',
                    is_primary: false,
                  },
                  {
                    job: 'Primary Staff Designer',
                    company: 'Primary Studio',
                    is_primary: true,
                  },
                ],
              },
            },
          ]),
        })
      );
      expect(withPrimary.job_title).toBe('Primary Staff Designer');
      expect(withPrimary.company).toBe('Primary Studio');

      // 2. None marked is_primary -> first work experience wins
      const withoutExplicitPrimary = projectUserProfile(
        buildBaseDto({
          experiences: fromAny([
            {
              category: ExperienceType.WORK,
              order: 1,
              mentor_experiences_metadata: {
                data: [
                  { job: 'First Role', company: 'First Co', is_primary: false },
                  {
                    job: 'Second Role',
                    company: 'Second Co',
                    is_primary: false,
                  },
                ],
              },
            },
          ]),
        })
      );
      expect(withoutExplicitPrimary.job_title).toBe('First Role');
      expect(withoutExplicitPrimary.company).toBe('First Co');

      // 3. Explicit empty strings on primary work experience do NOT fall back to outer stale fields
      const emptyPrimaryWork = projectUserProfile(
        buildBaseDto({
          job_title: 'Stale Top Title',
          company: 'Stale Top Co',
          experiences: fromAny([
            {
              category: ExperienceType.WORK,
              order: 1,
              mentor_experiences_metadata: {
                data: [{ job: '', company: '', is_primary: true }],
              },
            },
          ]),
        })
      );
      expect(emptyPrimaryWork.job_title).toBe('');
      expect(emptyPrimaryWork.company).toBe('');

      // 4. Empty or null experiences -> falls back to top-level job_title / company
      const noWork = projectUserProfile(
        buildBaseDto({
          job_title: 'Top-Level Fallback Title',
          company: 'Top-Level Fallback Co',
          experiences: null,
        })
      );
      expect(noWork.job_title).toBe('Top-Level Fallback Title');
      expect(noWork.company).toBe('Top-Level Fallback Co');
    });

    it('falls back location to primary work experience job_location when top-level location is empty and supports en_US country labels', () => {
      const dto = buildBaseDto({
        location: '',
        experiences: fromAny([
          {
            category: ExperienceType.WORK,
            order: 1,
            mentor_experiences_metadata: {
              data: [
                { job: 'Role A', company: 'Co A', job_location: 'USA' },
                {
                  job: 'Role B',
                  company: 'Co B',
                  job_location: 'JPN',
                  is_primary: true,
                },
              ],
            },
          },
        ]),
      });

      const zhProjected = projectUserProfile(dto, { language: 'zh_TW' });
      expect(zhProjected.location).toBe('日本');
      expect(zhProjected.location_code).toBeNull();

      const enProjected = projectUserProfile(dto, { language: 'en_US' });
      expect(enProjected.location).toBe('Japan');
    });

    it('deduplicates work experience industries against primary industry and normalizes personalLinks identically for client and SEO', () => {
      const dto = buildBaseDto({
        experiences: fromAny([
          {
            category: ExperienceType.WORK,
            order: 1,
            mentor_experiences_metadata: {
              data: [
                {
                  job: 'Designer',
                  company: 'Studio',
                  industry: 'DESIGN',
                  is_primary: true,
                },
                {
                  job: 'Engineer',
                  company: 'TechCo',
                  industry: 'SOFTWARE',
                  is_primary: false,
                },
              ],
            },
          },
          {
            category: ExperienceType.LINK,
            order: 3,
            mentor_experiences_metadata: {
              data: [
                { platform: 'github', url: 'https://github.com/first-handle' },
                { platform: 'github', url: 'https://github.com/second-handle' },
                {
                  platform: 'linkedin',
                  url: 'https://linkedin.com/in/zahra',
                },
              ],
            },
          },
        ]),
      });

      const projected = projectUserProfile(dto, { catalogs: SAMPLE_CATALOGS });
      expect(projected.industries).toEqual([
        { subject_group: 'DESIGN', subject: '設計及創意相關業' },
        { subject_group: 'SOFTWARE', subject: '軟體及網路相關業' },
      ]);
      expect(projected.personalLinks).toEqual([
        { platform: 'linkedin', url: 'https://linkedin.com/in/zahra' },
        { platform: 'github', url: 'https://github.com/first-handle' },
      ]);
    });
  });

  describe('deriveProfilePageViewModel', () => {
    function buildUser(overrides: Partial<UserType> = {}): UserType {
      return fromPartial<UserType>({
        user_id: 101,
        name: 'Jane Mentor',
        is_mentor: true,
        industry: '##設計及創意相關業',
        stats: {
          completed_meeting_count: 25,
          rating_count: 8,
          rating_average: 9.2,
        },
        ...overrides,
      });
    }

    it('derives owner controls, Become Mentor CTA, and mentor bookmark strictly from canShowOwnerControls without re-comparing loginUserId', () => {
      // Mentor owner
      const mentorOwner = deriveProfilePageViewModel({
        userData: buildUser({ is_mentor: true }),
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: true,
        favoritesEnabled: true,
        feedbackEnabled: true,
      });
      expect(mentorOwner.isOwnMentorProfile).toBe(true);
      expect(mentorOwner.canShowEditProfileButton).toBe(true);
      expect(mentorOwner.canShowMentorOwnerControls).toBe(true);
      expect(mentorOwner.canShowMenteeOwnerControls).toBe(false);
      expect(mentorOwner.canShowBecomeMentorCta).toBe(false);
      expect(mentorOwner.canShowMentorBookmark).toBe(false);

      // Mentor visitor (settled)
      const mentorVisitor = deriveProfilePageViewModel({
        userData: buildUser({ is_mentor: true }),
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: false,
        favoritesEnabled: true,
        feedbackEnabled: true,
      });
      expect(mentorVisitor.isOwnMentorProfile).toBe(false);
      expect(mentorVisitor.canShowEditProfileButton).toBe(false);
      expect(mentorVisitor.canShowMentorBookmark).toBe(true);

      // Mentor visitor while identity is unresolved -> withholds bookmark
      const unresolvedVisitor = deriveProfilePageViewModel({
        userData: buildUser({ is_mentor: true }),
        userLoading: false,
        isIdentityResolved: false,
        canShowOwnerControls: false,
        favoritesEnabled: true,
      });
      expect(unresolvedVisitor.canShowMentorBookmark).toBe(false);

      // Mentee owner on /profile/[id] (#960 default: Become Mentor CTA hidden) vs opted-in surface (#973)
      const menteeOwnerDefault = deriveProfilePageViewModel({
        userData: buildUser({ is_mentor: false }),
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: true,
      });
      expect(menteeOwnerDefault.canShowMenteeOwnerControls).toBe(true);
      expect(menteeOwnerDefault.canShowBecomeMentorCta).toBe(false);
      expect(menteeOwnerDefault.canShowMentorBookmark).toBe(false);
      expect(menteeOwnerDefault.showScheduleRegion).toBe(false);

      const menteeOwnerWithCta = deriveProfilePageViewModel({
        userData: buildUser({ is_mentor: false }),
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: true,
        enableBecomeMentorCta: true,
      });
      expect(menteeOwnerWithCta.canShowBecomeMentorCta).toBe(true);
    });

    it('prioritizes fresh feedback stats over SSR userData.stats, falls back to SSR stats on 404 fallback-empty, and suppresses rating when feedbackEnabled is false or count is 0', () => {
      const userData = buildUser({
        stats: {
          completed_meeting_count: 64,
          rating_count: 12,
          rating_average: 9.2,
        },
      });

      // Fresh feedback overrides SSR stats
      const fresh = deriveProfilePageViewModel({
        userData,
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: false,
        feedbackEnabled: true,
        feedback: {
          hasLoaded: true,
          isFallbackEmpty: false,
          totalRatingCount: 15,
          ratingAverage: 9.6,
          completedMeetingCount: 70,
        },
      });
      expect(fresh.hasFreshFeedback).toBe(true);
      expect(fresh.effectiveRatingCount).toBe(15);
      expect(fresh.effectiveRatingAverage).toBe(9.6);
      expect(fresh.effectiveCompletedMeetings).toBe(70);

      // 404 fallback-empty preserves SSR stats
      const fallbackEmpty = deriveProfilePageViewModel({
        userData,
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: false,
        feedbackEnabled: true,
        feedback: {
          hasLoaded: true,
          isFallbackEmpty: true,
          totalRatingCount: 0,
          ratingAverage: null,
          completedMeetingCount: null,
        },
      });
      expect(fallbackEmpty.hasFreshFeedback).toBe(false);
      expect(fallbackEmpty.effectiveRatingCount).toBe(12);
      expect(fallbackEmpty.effectiveRatingAverage).toBe(9.2);
      expect(fallbackEmpty.effectiveCompletedMeetings).toBe(64);

      // feedbackEnabled = false hides ratings while preserving completed meetings
      const disabled = deriveProfilePageViewModel({
        userData,
        userLoading: false,
        isIdentityResolved: true,
        canShowOwnerControls: false,
        feedbackEnabled: false,
      });
      expect(disabled.effectiveRatingCount).toBe(0);
      expect(disabled.effectiveRatingAverage).toBeNull();
      expect(disabled.effectiveCompletedMeetings).toBe(64);
      expect(disabled.mentorIndustryHashtag).toBe('#設計及創意相關業');
    });
  });
});

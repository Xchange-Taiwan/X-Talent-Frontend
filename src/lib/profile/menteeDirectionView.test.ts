import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { UserType } from '@/types/user';

import {
  buildMenteeDirectionReadGroups,
  DEFAULT_MENTEE_AVATAR_URL,
  isMenteeProfileEmpty,
  readStoredMenteeDirectionViewMap,
  resolveMenteeAvatarSrc,
  resolveMenteeExperienceSummary,
  resolveMenteeIndustryHashtag,
  resolveMenteeLatestRole,
} from './menteeDirectionView';

describe('menteeDirectionView', () => {
  it('returns empty array when Mentee has no selected positions', () => {
    expect(
      buildMenteeDirectionReadGroups({
        positions: [],
        skills: [{ subject_group: 'ux', subject: 'UX Research' }],
        topics: [{ subject_group: 'portfolio', subject: '作品集檢視' }],
      })
    ).toEqual([]);
  });

  it('reconciles stored direction map and falls back unassigned tags onto primary position', () => {
    const groups = buildMenteeDirectionReadGroups({
      positions: [
        { subject_group: 'uiux', subject: '產品設計／UIUX' },
        { subject_group: 'fe', subject: '前端工程' },
      ],
      skills: [
        { subject_group: 'ux_research', subject: 'UX Research' },
        { subject_group: 'design_system', subject: '設計系統' },
        { subject_group: 'react', subject: 'React' },
        { subject_group: 'legacy_skill', subject: 'Figma' },
      ],
      topics: [
        { subject_group: 'portfolio', subject: '作品集檢視' },
        { subject_group: 'career', subject: '職涯規劃' },
      ],
      storedMap: {
        uiux: {
          skills: ['ux_research', 'design_system', 'stale_removed'],
          topics: ['portfolio'],
        },
        fe: {
          skills: ['react'],
          topics: ['career'],
        },
      },
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      key: 'uiux',
      label: '產品設計／UIUX',
      skills: [
        { subject_group: 'ux_research', subject: 'UX Research' },
        { subject_group: 'design_system', subject: '設計系統' },
        { subject_group: 'legacy_skill', subject: 'Figma' },
      ],
      topics: [{ subject_group: 'portfolio', subject: '作品集檢視' }],
      totalCount: 4,
    });
    expect(groups[1]).toEqual({
      key: 'fe',
      label: '前端工程',
      skills: [{ subject_group: 'react', subject: 'React' }],
      topics: [{ subject_group: 'career', subject: '職涯規劃' }],
      totalCount: 2,
    });
  });

  it('isolates Object.prototype keys (__proto__, constructor, toString) without throwing or polluting', () => {
    const mockStore: Record<string, string> = {
      'xtalent:mentee-direction-map:v1:202':
        '{"__proto__":{"skills":["hacked"],"topics":[]},"constructor":{"skills":["bad"],"topics":[]},"uiux":{"skills":["ux_research"],"topics":["portfolio"]}}',
      'xtalent:mentee-direction-map:v1:999': '{malformed-json',
    };
    const reader = (key: string) => mockStore[key] ?? null;

    const parsed = readStoredMenteeDirectionViewMap(202, reader);
    expect(parsed?.['uiux']).toEqual({
      skills: ['ux_research'],
      topics: ['portfolio'],
    });
    expect(parsed ? Object.hasOwn(parsed, '__proto__') : false).toBe(false);
    expect(parsed ? Object.hasOwn(parsed, 'constructor') : false).toBe(false);
    expect(readStoredMenteeDirectionViewMap(999, reader)).toBeNull();
    expect(readStoredMenteeDirectionViewMap(null, reader)).toBeNull();

    const safeGroups = buildMenteeDirectionReadGroups({
      positions: [
        { subject_group: 'constructor', subject: 'Constructor Role' },
        { subject_group: 'toString', subject: 'ToString Role' },
      ],
      skills: [],
      topics: [],
      storedMap: {},
    });
    expect(safeGroups).toHaveLength(2);
    expect(safeGroups[0].totalCount).toBe(0);
  });

  it('resolves Mentee default_1 avatar, preset codes, latest work role, and summed experience years (#960)', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    for (let i = 1; i <= 6; i += 1) {
      const p = path.join(publicDir, 'avatars', `default_${i}.webp`);
      expect(fs.existsSync(p)).toBe(true);
    }

    expect(resolveMenteeAvatarSrc('')).toBe(DEFAULT_MENTEE_AVATAR_URL);
    expect(resolveMenteeAvatarSrc('default_3')).toBe('/avatars/default_3.webp');
    expect(resolveMenteeLatestRole({ workExperiences: [] }, 2026)).toBeNull();
    expect(
      resolveMenteeLatestRole(
        {
          workExperiences: [
            {
              job: 'Intern Designer',
              company: 'Early Co',
              job_period_start: '2021',
              job_period_end: '2023',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
            {
              job: 'Product Designer',
              company: 'Flow Studio',
              job_period_start: '2024',
              job_period_end: '至今',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: true,
            },
          ],
        },
        2026
      )
    ).toEqual({ jobTitle: 'Product Designer', company: 'Flow Studio' });
    expect(
      resolveMenteeExperienceSummary(
        {
          workExperiences: [
            {
              job: 'Intern Designer',
              company: 'Early Co',
              job_period_start: '2021',
              job_period_end: '2023',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
            {
              job: 'Product Designer',
              company: 'Flow Studio',
              job_period_start: '2024',
              job_period_end: 'now',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: true,
            },
          ],
        },
        2026
      )
    ).toBe('4 年');
  });

  it('detects empty vs filled Mentee profile state and normalizes industry hashtag', () => {
    const emptyUser: UserType = {
      user_id: 202,
      name: '陳小華',
      avatar: '/avatars/default_1.webp',
      job_title: '',
      company: '',
      is_mentor: false,
      want_position: [],
      want_skill: [],
      want_topic: [],
      have_skill: [],
      have_topic: [],
    };

    expect(isMenteeProfileEmpty(emptyUser, 0, undefined)).toBe(true);
    expect(resolveMenteeIndustryHashtag(emptyUser)).toBeNull();

    const filledUser: UserType = {
      ...emptyUser,
      industry: '#設計及創意相關業',
    };
    expect(resolveMenteeIndustryHashtag(filledUser)).toBe('#設計及創意相關業');
    expect(isMenteeProfileEmpty(filledUser, 0, undefined)).toBe(false);
  });

  it('covers experience summary & latest role edge cases: empty fallback, same-year 1y minimum, invalid ranges, and same-end-year tie breaking', () => {
    expect(
      resolveMenteeExperienceSummary(
        {
          workExperiences: [],
          years_of_experience: '1~3 年',
        },
        2026
      )
    ).toBe('1~3 年');

    // Same start & end year counts as at least 1 year
    expect(
      resolveMenteeExperienceSummary(
        {
          workExperiences: [
            {
              job: 'Design Intern',
              company: 'Studio A',
              job_period_start: '2024',
              job_period_end: '2024',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: true,
            },
          ],
          years_of_experience: '1~3 年',
        },
        2026
      )
    ).toBe('1 年');

    // Non-numeric / inverted ranges are skipped and fall back to years_of_experience
    expect(
      resolveMenteeExperienceSummary(
        {
          workExperiences: [
            {
              job: 'Broken Period',
              company: 'Co A',
              job_period_start: '2024-06',
              job_period_end: '2025-01',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
            {
              job: 'Inverted',
              company: 'Co B',
              job_period_start: '2026',
              job_period_end: '2023',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
          ],
          years_of_experience: '3~5 年',
        },
        2026
      )
    ).toBe('3~5 年');

    // Same end year ('now' / '至今') prefers the entry with the later start year
    expect(
      resolveMenteeLatestRole(
        {
          workExperiences: [
            {
              job: 'Part-time Advisor',
              company: 'Older Ongoing Co',
              job_period_start: '2022',
              job_period_end: 'now',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
            {
              job: 'Senior Product Designer',
              company: 'Newer Ongoing Co',
              job_period_start: '2025',
              job_period_end: '至今',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: true,
            },
          ],
        },
        2026
      )
    ).toEqual({
      jobTitle: 'Senior Product Designer',
      company: 'Newer Ongoing Co',
    });

    // Blank draft entry with newer end date must NOT hide valid historical experience
    expect(
      resolveMenteeLatestRole(
        {
          workExperiences: [
            {
              job: 'Product Designer',
              company: 'XChange',
              job_period_start: '2023',
              job_period_end: '2025',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: true,
            },
            {
              job: '   ',
              company: '',
              job_period_start: '2026',
              job_period_end: '至今',
              industry: 'DESIGN',
              job_location: 'TWN',
              description: '',
              is_primary: false,
            },
          ],
        },
        2026
      )
    ).toEqual({
      jobTitle: 'Product Designer',
      company: 'XChange',
    });
  });
});

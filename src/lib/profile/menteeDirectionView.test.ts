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
    expect(resolveMenteeAvatarSrc('')).toBe(DEFAULT_MENTEE_AVATAR_URL);
    expect(resolveMenteeAvatarSrc('default_3')).toBe('/avatars/default_3.webp');
    expect(resolveMenteeLatestRole({ workExperiences: [] }, 2026)).toBeNull();
    expect(
      resolveMenteeLatestRole(
        {
          workExperiences: [
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
    ).toBe('2 年');
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
});

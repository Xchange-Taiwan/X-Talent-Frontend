import { describe, expect, it } from 'vitest';

import type { UserType } from '@/types/user';

import {
  buildMenteeDirectionReadGroups,
  isMenteeProfileEmpty,
  readStoredMenteeDirectionViewMap,
  resolveMenteeIndustryHashtag,
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

  it('reads stored direction map safely via reader and handles malformed payloads', () => {
    const mockStore: Record<string, string> = {
      'xtalent:mentee-direction-map:v1:202': JSON.stringify({
        uiux: { skills: ['ux_research'], topics: ['portfolio'] },
      }),
      'xtalent:mentee-direction-map:v1:999': '{malformed-json',
    };
    const reader = (key: string) => mockStore[key] ?? null;

    expect(readStoredMenteeDirectionViewMap(202, reader)).toEqual({
      uiux: { skills: ['ux_research'], topics: ['portfolio'] },
    });
    expect(readStoredMenteeDirectionViewMap(999, reader)).toBeNull();
    expect(readStoredMenteeDirectionViewMap(null, reader)).toBeNull();
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

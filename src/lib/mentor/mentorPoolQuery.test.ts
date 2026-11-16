import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import {
  buildHref,
  buildMentorFilterOptions,
  buildMentorPoolHref,
  clearAllConditions,
  DEFAULT_MENTOR_FILTER_OPTIONS,
  getSearchPatternFromParams,
  hasAnyCondition,
  isUnfilteredMentorPoolQuery,
  normalizeFilterValue,
  normalizeMentorPoolQuery,
  parseFiltersFromParams,
  parseFilterTokens,
  parseMentorPoolQuery,
  removeFilterFromParams,
  resolveActiveFilterBadges,
  setSearchPattern,
  setSelectedFiltersOnParams,
  toMentorRequest,
  UNFILTERED_MENTOR_POOL_QUERY,
} from './mentorPoolQuery';

describe('mentorPoolQuery (#897)', () => {
  describe('getSearchPatternFromParams', () => {
    it('returns empty string when params is null or undefined', () => {
      expect(getSearchPatternFromParams(null)).toBe('');
      expect(getSearchPatternFromParams(undefined)).toBe('');
    });

    it('returns empty string when q is missing or whitespace-only', () => {
      expect(getSearchPatternFromParams(new URLSearchParams(''))).toBe('');
      expect(getSearchPatternFromParams('?q=%20%20')).toBe('');
    });

    it('returns trimmed q parameter value when present', () => {
      expect(
        getSearchPatternFromParams(new URLSearchParams('q=frontend'))
      ).toBe('frontend');
      expect(
        getSearchPatternFromParams('?q=%20UIUX%20%E8%A8%AD%E8%A8%88%20')
      ).toBe('UIUX 設計');
    });
  });

  describe('parseFilterTokens & normalizeFilterValue', () => {
    it('splits comma-separated tokens, trims whitespace, drops blanks, and deduplicates', () => {
      expect(parseFilterTokens(null)).toEqual([]);
      expect(parseFilterTokens('   ')).toEqual([]);
      expect(parseFilterTokens(' , , ')).toEqual([]);
      expect(
        parseFilterTokens(' skill_ts , skill_figma , skill_ts , ')
      ).toEqual(['skill_ts', 'skill_figma']);
    });

    it('normalizes multi-token values into sorted canonical strings and whitespace to undefined', () => {
      expect(normalizeFilterValue('   ')).toBeUndefined();
      expect(normalizeFilterValue(' , ')).toBeUndefined();
      expect(normalizeFilterValue(' skill_ts ')).toBe('skill_ts');
      expect(normalizeFilterValue('skill_ts, skill_figma, skill_ts')).toBe(
        'skill_figma,skill_ts'
      );
    });
  });

  describe('parseFiltersFromParams', () => {
    it('returns empty object when params is null, empty, or whitespace-only', () => {
      expect(parseFiltersFromParams(null)).toEqual({});
      expect(parseFiltersFromParams(new URLSearchParams(''))).toEqual({});
      expect(
        parseFiltersFromParams(
          new URLSearchParams('filter_skills=%20&filter_topics=%20,%20')
        )
      ).toEqual({});
    });

    it('parses known single and comma-separated filter keys and ignores unknown keys', () => {
      const params = new URLSearchParams(
        'filter_skills=react,%20typescript&filter_industries=tech&unknown_key=value'
      );
      expect(parseFiltersFromParams(params)).toEqual({
        filter_skills: { name: '技能', value: 'react,typescript' },
        filter_industries: { name: '產業', value: 'tech' },
      });
    });

    it('handles custom options lacking a key or meta gracefully', () => {
      const params = new URLSearchParams('custom_filter=val');
      expect(
        parseFiltersFromParams(params, { custom_filter: fromAny(undefined) })
      ).toEqual({});
    });
  });

  describe('hasAnyCondition', () => {
    it('returns false when params is null, empty, tracking-only, or whitespace-only', () => {
      expect(hasAnyCondition(null)).toBe(false);
      expect(hasAnyCondition(new URLSearchParams(''))).toBe(false);
      expect(hasAnyCondition('?utm_source=discord&fbclid=123')).toBe(false);
      expect(hasAnyCondition('?unknown_key=123')).toBe(false);
      expect(hasAnyCondition('?filter_topics=%20&q=%20')).toBe(false);
    });

    it('returns true when q, valid filter_*, or valid sort_by is present', () => {
      expect(hasAnyCondition(new URLSearchParams('q=john'))).toBe(true);
      expect(hasAnyCondition(new URLSearchParams('filter_topics=vue'))).toBe(
        true
      );
      expect(hasAnyCondition(new URLSearchParams('sort_by=popularity'))).toBe(
        true
      );
      expect(hasAnyCondition(new URLSearchParams('sort_by=invalid'))).toBe(
        false
      );
    });
  });

  describe('round-trip URL mutations and clearAllConditions', () => {
    it('round-trips q, multi-value filters, and sort_by through parseMentorPoolQuery and clearAllConditions', () => {
      let params = new URLSearchParams(
        'utm_source=newsletter&utm_campaign=q4&sort_by=popularity'
      );

      params = setSearchPattern(params, '  React  ');
      params = setSelectedFiltersOnParams(params, {
        filter_skills: {
          name: '技能',
          value: 'skill_typescript, skill_figma',
        },
        filter_topics: {
          name: '主題',
          value: '   ',
        },
      });

      expect(params.get('utm_source')).toBe('newsletter');
      expect(params.get('sort_by')).toBe('popularity');
      expect(params.get('filter_topics')).toBeNull();

      const parsed = parseMentorPoolQuery(params);
      expect(parsed).toEqual({
        search_pattern: 'React',
        filter_skills: 'skill_figma,skill_typescript',
        sort_by: 'popularity',
      });
      expect(toMentorRequest(parsed, { limit: 9 })).toEqual({
        search_pattern: 'React',
        filter_skills: 'skill_figma,skill_typescript',
        sort_by: 'popularity',
        limit: 9,
      });

      // Remove a single token from a comma-separated filter while keeping the rest
      params = removeFilterFromParams(
        params,
        'filter_skills',
        'skill_typescript'
      );
      expect(params.get('filter_skills')).toBe('skill_figma');
      expect(parseMentorPoolQuery(params)).toEqual({
        search_pattern: 'React',
        filter_skills: 'skill_figma',
        sort_by: 'popularity',
      });

      // Remove the final token -> deletes the filter key completely
      params = removeFilterFromParams(params, 'filter_skills', 'skill_figma');
      expect(params.has('filter_skills')).toBe(false);

      // Add a future/custom filter_* key as well and verify clearAllConditions strips ALL filter_*, q, and sort_by
      params.set('filter_skills', 'skill_figma');
      params.set('filter_seniority', 'senior');

      const cleared = clearAllConditions(params);
      expect(cleared.toString()).toBe('utm_source=newsletter&utm_campaign=q4');
      expect(parseMentorPoolQuery(cleared)).toBe(UNFILTERED_MENTOR_POOL_QUERY);
      expect(isUnfilteredMentorPoolQuery(parseMentorPoolQuery(cleared))).toBe(
        true
      );
    });

    it('clears q when setSearchPattern receives empty or whitespace string', () => {
      const base = new URLSearchParams('q=react&other=1');
      expect(setSearchPattern(base, '').toString()).toBe('other=1');
      expect(setSearchPattern(base, '   ').toString()).toBe('other=1');
    });

    it('removes entire filter key when removeFilterFromParams is called without a token value', () => {
      const base = new URLSearchParams(
        'q=hello&filter_skills=skill_a,skill_b&filter_topics=topic_a'
      );
      const res = removeFilterFromParams(base, 'filter_skills');
      expect(res.toString()).toBe('q=hello&filter_topics=topic_a');
    });

    it('handles null base across mutation helpers', () => {
      expect(setSearchPattern(null, 'react').toString()).toBe('q=react');
      expect(
        setSelectedFiltersOnParams(null, {
          filter_skills: { name: '技能', value: 'react' },
        }).toString()
      ).toBe('filter_skills=react');
      expect(removeFilterFromParams(null, 'filter_skills').toString()).toBe('');
      expect(clearAllConditions(null).toString()).toBe('');
    });
  });

  describe('utm_* invariance & canonical normalization', () => {
    it('normalizes utm_*, fbclid, gclid, and reordered params to identical MentorPoolQuery shapes', () => {
      const fromUtm = parseMentorPoolQuery(
        '?utm_source=discord&utm_medium=social&filter_topics=topic_b&q=react&filter_skills=skill_b,skill_a'
      );
      const fromCleanReordered = parseMentorPoolQuery(
        '?filter_skills=skill_a,%20skill_b&q=react&filter_topics=topic_b&fbclid=xyz'
      );

      expect(fromUtm).toEqual(fromCleanReordered);
      expect(
        normalizeMentorPoolQuery({
          search_pattern: '   ',
          filter_skills: ' , ',
        })
      ).toBe(UNFILTERED_MENTOR_POOL_QUERY);
    });
  });

  describe('resolveActiveFilterBadges', () => {
    const customOptions = {
      ...DEFAULT_MENTOR_FILTER_OPTIONS,
      filter_skills: {
        name: '技能',
        options: [
          { label: 'TypeScript', value: 'skill_typescript' },
          { label: 'Figma', value: 'skill_figma' },
        ],
      },
      filter_industries: {
        name: '產業',
        options: [{ label: '文化教育', value: 'culture_education' }],
      },
    };

    it('splits comma-separated tokens into localized badges and falls back to token when unknown', () => {
      const badges = resolveActiveFilterBadges(
        {
          filter_skills: {
            name: '技能',
            value: 'skill_typescript, skill_figma, unknown_skill',
          },
          filter_industries: {
            name: '產業',
            value: 'culture_education',
          },
        },
        customOptions
      );

      expect(badges).toEqual([
        {
          key: 'filter_skills',
          name: '技能',
          value: 'skill_typescript',
          label: 'TypeScript',
        },
        {
          key: 'filter_skills',
          name: '技能',
          value: 'skill_figma',
          label: 'Figma',
        },
        {
          key: 'filter_skills',
          name: '技能',
          value: 'unknown_skill',
          label: 'unknown_skill',
        },
        {
          key: 'filter_industries',
          name: '產業',
          value: 'culture_education',
          label: '文化教育',
        },
      ]);
    });

    it('omits empty and whitespace-only filter entries instead of producing blank badges', () => {
      const badges = resolveActiveFilterBadges(
        {
          filter_skills: { name: '技能', value: '   ' },
          filter_topics: { name: '主題', value: ' , , ' },
        },
        customOptions
      );

      expect(badges).toEqual([]);
    });
  });

  describe('buildMentorFilterOptions & buildMentorPoolHref', () => {
    it('projects TagCatalogsByBucket leaves and flat industry options while dropping empty subject_group entries', () => {
      const projected = buildMentorFilterOptions({
        have_skill: [
          {
            subject_group: 'group_fe',
            subject: '前端群組',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 1,
                subject_group: 'skill_react',
                subject: 'React',
                language: 'zh_TW',
              },
              {
                tag_id: 2,
                subject_group: '',
                subject: '無效標籤',
                language: 'zh_TW',
              },
            ],
          },
        ],
        have_topic: [
          {
            subject_group: 'group_career',
            subject: '職涯群組',
            language: 'zh_TW',
            leaves: [
              {
                tag_id: 3,
                subject_group: 'topic_resume',
                subject: '履歷健檢',
                language: 'zh_TW',
              },
            ],
          },
        ],
        industry: [{ subject_group: 'software_internet', subject: '軟體網路' }],
      });

      expect(projected.filter_skills.options).toEqual([
        { label: 'React', value: 'skill_react' },
      ]);
      expect(projected.filter_topics.options).toEqual([
        { label: '履歷健檢', value: 'topic_resume' },
      ]);
      expect(projected.filter_industries.options).toEqual([
        { label: '軟體網路', value: 'software_internet' },
      ]);
    });

    it('builds mentor-pool href with or without query string', () => {
      expect(buildMentorPoolHref(new URLSearchParams(''))).toBe('/mentor-pool');
      expect(buildHref(new URLSearchParams('q=hello'))).toBe(
        '/mentor-pool?q=hello'
      );
    });
  });
});

import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it } from 'vitest';

import {
  buildHref,
  clearAllConditions,
  getSearchPatternFromParams,
  hasAnyCondition,
  paramsToFetchConditions,
  parseFiltersFromParams,
  removeFilterFromParams,
  setSearchPattern,
  setSelectedFiltersOnParams,
} from './searchParams';

describe('searchParams', () => {
  describe('getSearchPatternFromParams', () => {
    it('returns empty string when params is null', () => {
      expect(getSearchPatternFromParams(null)).toBe('');
    });

    it('returns empty string when q is missing', () => {
      const params = new URLSearchParams('');
      expect(getSearchPatternFromParams(params)).toBe('');
    });

    it('returns the search pattern when q is present', () => {
      const params = new URLSearchParams('q=javascript');
      expect(getSearchPatternFromParams(params)).toBe('javascript');
    });

    it('returns empty string when q is empty', () => {
      const params = new URLSearchParams('q=');
      expect(getSearchPatternFromParams(params)).toBe('');
    });
  });

  describe('parseFiltersFromParams', () => {
    it('returns empty object when params is null', () => {
      expect(parseFiltersFromParams(null)).toEqual({});
    });

    it('returns empty object when no filters are present', () => {
      const params = new URLSearchParams('q=hello');
      expect(parseFiltersFromParams(params)).toEqual({});
    });

    it('parses valid filters and ignores unknown keys', () => {
      const params = new URLSearchParams(
        'filter_skills=react&unknown_param=123'
      );
      const parsed = parseFiltersFromParams(params);
      expect(parsed).toEqual({
        filter_skills: {
          name: expect.any(String),
          value: 'react',
        },
      });
      expect(parsed.unknown_param).toBeUndefined();
    });

    it('ignores filter keys with empty values', () => {
      const params = new URLSearchParams('filter_skills=&filter_topics=react');
      const parsed = parseFiltersFromParams(params);
      expect(parsed).toEqual({
        filter_topics: {
          name: expect.any(String),
          value: 'react',
        },
      });
      expect(parsed.filter_skills).toBeUndefined();
    });
  });

  describe('paramsToFetchConditions', () => {
    it('returns default conditions when params is null', () => {
      expect(paramsToFetchConditions(null)).toEqual({
        search_pattern: '',
      });
    });

    it('maps search pattern and filters correctly', () => {
      const params = new URLSearchParams(
        'q=john&filter_skills=typescript&filter_topics=frontend'
      );
      expect(paramsToFetchConditions(params)).toEqual({
        search_pattern: 'john',
        filter_skills: 'typescript',
        filter_topics: 'frontend',
      });
    });

    it('skips empty and unknown filters', () => {
      const params = new URLSearchParams(
        'q=john&filter_skills=&unknown_filter=abc'
      );
      expect(paramsToFetchConditions(params)).toEqual({
        search_pattern: 'john',
      });
    });
  });

  describe('hasAnyCondition', () => {
    it('returns false when params is null', () => {
      expect(hasAnyCondition(null)).toBe(false);
    });

    it('returns false when params is empty', () => {
      const params = new URLSearchParams('');
      expect(hasAnyCondition(params)).toBe(false);
    });

    it('returns true when q is present', () => {
      const params = new URLSearchParams('q=john');
      expect(hasAnyCondition(params)).toBe(true);
    });

    it('returns false when q is empty and no filters present', () => {
      const params = new URLSearchParams('q=');
      expect(hasAnyCondition(params)).toBe(false);
    });

    it('returns true when at least one filter key is present', () => {
      const params = new URLSearchParams('filter_topics=vue');
      expect(hasAnyCondition(params)).toBe(true);
    });

    it('returns false when only unknown filter keys or empty filter keys are present', () => {
      const params1 = new URLSearchParams('unknown_key=123');
      const params2 = new URLSearchParams('filter_topics=');
      expect(hasAnyCondition(params1)).toBe(false);
      expect(hasAnyCondition(params2)).toBe(false);
    });
  });

  describe('setSearchPattern', () => {
    it('creates new URLSearchParams with search pattern when base is null', () => {
      const result = setSearchPattern(null, 'react');
      expect(result.toString()).toBe('q=react');
    });

    it('returns empty URLSearchParams when base is null and q is empty', () => {
      const result = setSearchPattern(null, '');
      expect(result.toString()).toBe('');
    });

    it('sets search pattern and keeps other parameters intact', () => {
      const base = new URLSearchParams('filter_skills=vue&other=val');
      const result = setSearchPattern(base, 'react');
      expect(result.get('q')).toBe('react');
      expect(result.get('filter_skills')).toBe('vue');
      expect(result.get('other')).toBe('val');
    });

    it('deletes search pattern and keeps other parameters intact when q is empty', () => {
      const base = new URLSearchParams('q=react&filter_skills=vue&other=val');
      const result = setSearchPattern(base, '');
      expect(result.has('q')).toBe(false);
      expect(result.get('filter_skills')).toBe('vue');
      expect(result.get('other')).toBe('val');
    });
  });

  describe('setSelectedFiltersOnParams', () => {
    it('returns empty params when base is null and filters are empty', () => {
      const result = setSelectedFiltersOnParams(null, {});
      expect(result.toString()).toBe('');
    });

    it('removes old filters and applies new ones, leaving other parameters intact', () => {
      const base = new URLSearchParams('q=hello&filter_skills=vue&other=val');
      const result = setSelectedFiltersOnParams(base, {
        filter_skills: { name: 'Skills', value: 'react' },
        filter_topics: { name: 'Topics', value: 'design' },
      });
      expect(result.get('q')).toBe('hello');
      expect(result.get('other')).toBe('val');
      expect(result.get('filter_skills')).toBe('react');
      expect(result.get('filter_topics')).toBe('design');
    });

    it('removes old filter remnants if they are not in the new filters', () => {
      const base = new URLSearchParams(
        'q=hello&filter_skills=vue&filter_topics=vue-topic'
      );
      const result = setSelectedFiltersOnParams(base, {
        filter_topics: { name: 'Topics', value: 'react-topic' },
      });
      expect(result.get('q')).toBe('hello');
      expect(result.get('filter_skills')).toBeNull();
      expect(result.get('filter_topics')).toBe('react-topic');
    });

    it('clears all filters when filters object has empty or null values', () => {
      const base = new URLSearchParams('q=hello&filter_skills=vue');
      const result = setSelectedFiltersOnParams(base, {
        filter_skills: fromAny(undefined),
        filter_topics: fromAny(null),
      });
      expect(result.get('q')).toBe('hello');
      expect(result.get('filter_skills')).toBeNull();
      expect(result.get('filter_topics')).toBeNull();
    });
  });

  describe('removeFilterFromParams', () => {
    it('removes specified filter parameter and leaves others intact', () => {
      const base = new URLSearchParams(
        'q=hello&filter_skills=react&filter_topics=design'
      );
      const result = removeFilterFromParams(base, 'filter_skills');
      expect(result.has('filter_skills')).toBe(false);
      expect(result.get('q')).toBe('hello');
      expect(result.get('filter_topics')).toBe('design');
    });
  });

  describe('clearAllConditions', () => {
    it('clears q and all recognized filter parameters while keeping other parameters', () => {
      const base = new URLSearchParams(
        'q=hello&filter_skills=react&filter_topics=design&other=123'
      );
      const result = clearAllConditions(base);
      expect(result.has('q')).toBe(false);
      expect(result.has('filter_skills')).toBe(false);
      expect(result.has('filter_topics')).toBe(false);
      expect(result.get('other')).toBe('123');
    });
  });

  describe('buildHref', () => {
    it('returns path without query string when params is empty', () => {
      expect(buildHref(new URLSearchParams(''))).toBe('/mentor-pool');
    });

    it('returns path with query string when params are present', () => {
      expect(buildHref(new URLSearchParams('q=hello'))).toBe(
        '/mentor-pool?q=hello'
      );
    });
  });
});

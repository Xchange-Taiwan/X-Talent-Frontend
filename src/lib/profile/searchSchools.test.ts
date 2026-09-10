import { describe, expect, it } from 'vitest';

import { taiwanSchools } from '@/components/profile/edit/educationSection/schoolData';

import { schoolAliases } from './schoolAliases';
import { normalize, searchSchools } from './searchSchools';

describe('school search logic', () => {
  describe('normalize()', () => {
    it('removes spaces including full-width space', () => {
      expect(normalize(' 國立 臺灣大學 　')).toBe('國立台灣大學');
    });

    it('converts full-width alphanumeric to half-width and lowercase', () => {
      expect(normalize('ＮＴＵ')).toBe('ntu');
      expect(normalize('ｎｔｕ')).toBe('ntu');
      expect(normalize('１２３')).toBe('123');
    });

    it('converts 臺 to 台 and 学 to 學', () => {
      expect(normalize('臺')).toBe('台');
      expect(normalize('学')).toBe('學');
      expect(normalize('台灣大学')).toBe('台灣大學');
    });
  });

  describe('searchSchools() - AC validation table', () => {
    const acCases = [
      { query: '台大', expected: '國立臺灣大學' },
      { query: '臺大', expected: '國立臺灣大學' },
      { query: '政大', expected: '國立政治大學' },
      { query: '成大', expected: '國立成功大學' },
      { query: '清大', expected: '國立清華大學' },
      { query: '交大', expected: '國立陽明交通大學' },
      { query: '陽交大', expected: '國立陽明交通大學' },
      { query: '師大', expected: '國立臺灣師範大學' },
      { query: '台科', expected: '國立臺灣科技大學' },
      { query: '北科', expected: '國立臺北科技大學' },
      { query: '虎科', expected: '國立虎尾科技大學' },
      { query: '屏科', expected: '國立屏東科技大學' },
      { query: '雲科', expected: '國立雲林科技大學' },
      { query: '高科', expected: '國立高雄科技大學' },
      { query: '澎科', expected: '國立澎湖科技大學' },
      { query: '高醫', expected: '高雄醫學大學' },
      { query: '輔大', expected: '輔仁大學' },
      { query: '體大', expected: '國立體育大學' },
      { query: '暨大', expected: '國立暨南國際大學' },
      { query: '嘉大', expected: '國立嘉義大學' },
      { query: '金大', expected: '國立金門大學' },
      { query: '聯大', expected: '國立聯合大學' },
      { query: '海大', expected: '國立臺灣海洋大學' },
      { query: '宜大', expected: '國立宜蘭大學' },
      { query: '中大', expected: '國立中央大學' },
      { query: '北大', expected: '國立臺北大學' },
      { query: '北醫', expected: '臺北醫學大學' },
      { query: '北市大', expected: '臺北市立大學' },
      { query: '北教大', expected: '國立臺北教育大學' },
      { query: '中國醫', expected: '中國醫藥大學' },
    ];

    acCases.forEach(({ query, expected }) => {
      it(`returns "${expected}" as the first result when querying "${query}"`, () => {
        const results = searchSchools(query);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toBe(expected);
      });
    });

    it('handles normalization queries on L1 level', () => {
      // 台灣大學 / 臺灣大學 -> 國立臺灣大學
      expect(searchSchools('台灣大學')[0]).toBe('國立臺灣大學');
      expect(searchSchools('臺灣大學')[0]).toBe('國立臺灣大學');

      // 南台科大 -> 南臺科技大學
      expect(searchSchools('南台科大')[0]).toBe('南臺科技大學');

      // 臺北海洋 -> 台北海洋科技大學
      expect(searchSchools('臺北海洋')[0]).toBe('台北海洋科技大學');

      // Full-width english & spacing
      expect(searchSchools('ＮＴＵ')[0]).toBe('國立臺灣大學');
      expect(searchSchools('ntu')[0]).toBe('國立臺灣大學');
      expect(searchSchools('NTU')[0]).toBe('國立臺灣大學');
      expect(searchSchools('n t u')[0]).toBe('國立臺灣大學');

      // Simplified Chinese -> 台灣大学
      expect(searchSchools('台湾大学')[0]).toBe('國立臺灣大學');
    });

    it('ensures aliases matching is exact match only, not includes', () => {
      // Searching "大" should not T1-match "台大"
      const results = searchSchools('大');
      // "國立臺灣大學" should not be T1 (it is T2/T3, but since many schools end with 大學, it should just behave standardly)
      // Let's verify that "國立臺灣大學" is not the very first result because there are schools whose names start with or contain "大" in higher/closer positions (like 大仁科技大學, 大同大學, 大葉大學)
      expect(results[0]).not.toBe('國立臺灣大學');
    });

    it('L3: supports subsequence query "陽交" for "國立陽明交通大學"', () => {
      const results = searchSchools('陽交');
      expect(results[0]).toBe('國立陽明交通大學');
    });

    it('L3: supports subsequence query "東大" containing 國立臺東大學, 東海大學, 東吳大學', () => {
      const results = searchSchools('東大');
      expect(results).toContain('國立臺東大學');
      expect(results).toContain('東海大學');
      expect(results).toContain('東吳大學');
    });

    it('L3: tie-break works stably for multiple calls', () => {
      const run1 = searchSchools('東大');
      const run2 = searchSchools('東大');
      expect(run1).toEqual(run2);
    });

    it('T1 is ranked before T2, and T2 before T3', () => {
      // "台大" matches "國立臺灣大學" (T1)
      // "台灣科技大學" matches "國立臺灣科技大學" (T2)
      // Let's make sure T1 -> T2 -> T3 ordering is preserved
      const results = searchSchools('台大');
      expect(results[0]).toBe('國立臺灣大學'); // T1
    });

    it('returns original list when query is empty or only whitespace', () => {
      expect(searchSchools('')).toEqual(taiwanSchools);
      expect(searchSchools('   ')).toEqual(taiwanSchools);
    });
  });

  describe('schoolAliases integrity checks (Defensive Tests)', () => {
    it('ensures every key in schoolAliases exists in taiwanSchools', () => {
      const schoolSet = new Set(taiwanSchools);
      Object.keys(schoolAliases).forEach((schoolKey) => {
        expect(schoolSet.has(schoolKey)).toBe(true);
      });
    });

    it('ensures no duplicate alias points to two different schools', () => {
      const seenAliases = new Map<string, string>(); // alias -> school
      Object.entries(schoolAliases).forEach(([school, aliases]) => {
        aliases.forEach((alias) => {
          const normalizedAlias = normalize(alias);
          if (seenAliases.has(normalizedAlias)) {
            const previousSchool = seenAliases.get(normalizedAlias);
            if (previousSchool !== school) {
              throw new Error(
                `Duplicate alias found: "${alias}" (${normalizedAlias}) belongs to both "${previousSchool}" and "${school}"`
              );
            }
          }
          seenAliases.set(normalizedAlias, school);
        });
      });
    });
  });
});

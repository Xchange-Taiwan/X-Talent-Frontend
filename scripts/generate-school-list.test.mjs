import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  extractLatestYearSchools,
  generateSchoolDataTS,
  normalizeTS,
} from './generate-school-list.mjs';

describe('School List Generator - Helpers', () => {
  describe('normalizeTS()', () => {
    it('normalizes CRLF and LF newlines for deterministic drift checks', () => {
      const crlf = "export const taiwanSchools = [\r\n  '大同大學',\r\n];\r\n";
      const lf = "export const taiwanSchools = [\n  '大同大學',\n];\n";

      expect(normalizeTS(crlf)).toBe(normalizeTS(lf));
    });
  });

  describe('extractLatestYearSchools()', () => {
    it('keeps only the latest academic year, deduped and sorted', () => {
      const records = [
        { 學年度: '113', 學校名稱: '國立臺灣大學' },
        { 學年度: '113', 學校名稱: '馬偕醫學院' },
        { 學年度: '114', 學校名稱: '國立臺灣大學' },
        { 學年度: '114', 學校名稱: '馬偕醫學大學' },
        { 學年度: '114', 學校名稱: '國立清華大學' },
      ];

      const { latestYear, schools } = extractLatestYearSchools(records);

      expect(latestYear).toBe(114);
      expect(schools).toHaveLength(3);
      expect(schools).toEqual(
        expect.arrayContaining(['國立清華大學', '國立臺灣大學', '馬偕醫學大學'])
      );
      // Order must be stable and reproducible across runs, whatever the
      // underlying collation happens to pick.
      expect(schools).toEqual([...schools].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
    });

    it('drops a school that no longer appears in the latest year', () => {
      const records = [
        { 學年度: '113', 學校名稱: '大漢技術學院' },
        { 學年度: '114', 學校名稱: '國立臺灣大學' },
      ];

      const { schools } = extractLatestYearSchools(records);

      expect(schools).not.toContain('大漢技術學院');
    });

    it('dedupes a school that appears more than once within the latest year', () => {
      const records = [
        { 學年度: '114', 學校名稱: '國立臺灣大學' },
        { 學年度: '114', 學校名稱: '國立臺灣大學' },
      ];

      const { schools } = extractLatestYearSchools(records);

      expect(schools).toEqual(['國立臺灣大學']);
    });
  });

  describe('generateSchoolDataTS()', () => {
    it('emits a generated-file banner, the source year, and a single-quoted array', () => {
      const records = [
        { 學年度: '114', 學校名稱: '國立臺灣大學' },
        { 學年度: '114', 學校名稱: '國立清華大學' },
      ];

      const ts = generateSchoolDataTS(records);

      expect(ts).toContain('automatically generated');
      expect(ts).toContain('114 academic year');
      expect(ts).toContain('export const taiwanSchools = [');
      expect(ts).toContain("  '國立清華大學',");
      expect(ts).toContain("  '國立臺灣大學',");
      expect(ts.trim().endsWith('];')).toBe(true);
    });
  });
});

describe('School List Generator - Integration', () => {
  it('generates the committed schoolData.ts from the committed source data with no drift', () => {
    const records = JSON.parse(
      fs.readFileSync(
        path.resolve('scripts/data/moe-university-directory.json'),
        'utf8'
      )
    );
    const generated = generateSchoolDataTS(records);
    const committed = fs.readFileSync(
      path.resolve(
        'src/components/profile/edit/educationSection/schoolData.ts'
      ),
      'utf8'
    );

    expect(normalizeTS(generated)).toBe(normalizeTS(committed));
  });

  it('reflects the MOE fixes from X-Tracker #656 (additions, rename, removal)', () => {
    const records = JSON.parse(
      fs.readFileSync(
        path.resolve('scripts/data/moe-university-directory.json'),
        'utf8'
      )
    );
    const { schools } = extractLatestYearSchools(records);

    for (const added of [
      '國立成功大學',
      '國立政治大學',
      '國立臺灣師範大學',
      '馬偕醫學大學',
    ]) {
      expect(schools).toContain(added);
    }

    expect(schools).not.toContain('馬偕醫學院');
    expect(schools).not.toContain('大漢技術學院');
    expect(schools).not.toContain('其他');
  });
});

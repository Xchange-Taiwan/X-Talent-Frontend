import { describe, expect, it } from 'vitest';

import countriesEnUs from '@/data/countries.en_US.json';
import countriesZhTw from '@/data/countries.zh_TW.json';

import { getLocations, resolveLocationLabel } from './locations';

describe('locations domain lookup (src/lib/profile/locations)', () => {
  describe('getLocations', () => {
    it('synchronously returns zh_TW locations with TWN pinned first and remaining entries sorted by Intl.Collator("zh-TW")', () => {
      const list = getLocations('zh_TW');

      expect(list.length).toBe(Object.keys(countriesZhTw).length);
      expect(list[0]).toEqual({ value: 'TWN', text: '台灣' });

      const collator = new Intl.Collator('zh-TW');
      const rest = list.slice(1);
      const expectedRest = [...rest].sort((a, b) =>
        collator.compare(a.text, b.text)
      );
      expect(rest).toEqual(expectedRest);
    });

    it('synchronously returns en_US locations with TWN pinned first and remaining entries sorted by Intl.Collator("en-US")', () => {
      const list = getLocations('en_US');

      expect(list.length).toBe(Object.keys(countriesEnUs).length);
      expect(list[0]).toEqual({ value: 'TWN', text: 'Taiwan' });

      const collator = new Intl.Collator('en-US');
      const rest = list.slice(1);
      const expectedRest = [...rest].sort((a, b) =>
        collator.compare(a.text, b.text)
      );
      expect(rest).toEqual(expectedRest);
    });

    it('memoizes sorted arrays per locale for referential stability and falls back gracefully on empty locale', () => {
      const zhFirst = getLocations('zh_TW');
      const zhSecond = getLocations('zh_TW');
      const enFirst = getLocations('en_US');
      const enSecond = getLocations('en_US');

      expect(zhFirst).toBe(zhSecond);
      expect(enFirst).toBe(enSecond);
      expect(zhFirst).not.toBe(enFirst);

      const fallback = getLocations('');
      expect(fallback[0]).toEqual({ value: 'TWN', text: '台灣' });
    });
  });

  describe('resolveLocationLabel', () => {
    it('maps ISO3 country codes to localized country names across zh_TW and en_US', () => {
      expect(resolveLocationLabel('TWN', 'zh_TW')).toBe('台灣');
      expect(resolveLocationLabel('USA', 'zh_TW')).toBe('美國');
      expect(resolveLocationLabel('JPN', 'zh_TW')).toBe('日本');
      expect(resolveLocationLabel('SGP', 'zh_TW')).toBe('新加坡');

      expect(resolveLocationLabel('TWN', 'en_US')).toBe('Taiwan');
      expect(resolveLocationLabel('USA', 'en_US')).toBe('United States');
    });

    it('normalizes case and surrounding whitespace and defaults language to zh_TW', () => {
      expect(resolveLocationLabel('  twn  ')).toBe('台灣');
      expect(resolveLocationLabel('usa', 'en_US')).toBe('United States');
    });

    it('passes through unknown or already-localized strings trimmed and returns undefined for blank values', () => {
      expect(resolveLocationLabel('臺灣', 'zh_TW')).toBe('臺灣');
      expect(resolveLocationLabel('  Custom Location  ', 'zh_TW')).toBe(
        'Custom Location'
      );
      expect(resolveLocationLabel('', 'zh_TW')).toBeUndefined();
      expect(resolveLocationLabel('   ', 'zh_TW')).toBeUndefined();
      expect(resolveLocationLabel(null, 'zh_TW')).toBeUndefined();
      expect(resolveLocationLabel(undefined, 'zh_TW')).toBeUndefined();
    });
  });
});

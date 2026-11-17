import countriesEnUs from '@/data/countries.en_US.json';
import countriesZhTw from '@/data/countries.zh_TW.json';
import type { LocationType } from '@/types/location';

const memoizedLocations = new Map<string, LocationType[]>();

function selectCountryTable(language: string): Record<string, string> {
  return language === 'en_US' ? countriesEnUs : countriesZhTw;
}

function createLocaleCollator(language: string): Intl.Collator {
  const candidate = language.trim().replace(/_/g, '-');
  if (candidate) {
    try {
      return new Intl.Collator(candidate);
    } catch {
      // Fall back to zh-TW when given a malformed locale string
    }
  }
  return new Intl.Collator('zh-TW');
}

export function getLocations(language = 'zh_TW'): LocationType[] {
  const cached = memoizedLocations.get(language);
  if (cached) {
    return cached;
  }

  const table = selectCountryTable(language);
  const collator = createLocaleCollator(language);
  const list = Object.entries(table)
    .map(([value, text]) => ({ value, text }))
    .sort((a, b) => collator.compare(a.text, b.text));

  const twnIndex = list.findIndex((c) => c.value === 'TWN');
  if (twnIndex > 0) {
    list.unshift(list.splice(twnIndex, 1)[0]);
  }

  memoizedLocations.set(language, list);
  return list;
}

export function resolveLocationLabel(
  rawLocation: string | null | undefined,
  language = 'zh_TW'
): string | undefined {
  const trimmed = rawLocation?.trim();
  if (!trimmed) {
    return undefined;
  }

  const table = selectCountryTable(language);
  const upper = trimmed.toUpperCase();
  return table[upper] ?? trimmed;
}

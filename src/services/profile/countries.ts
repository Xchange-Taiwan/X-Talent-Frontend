import countriesEnUS from '@/data/countries.en_US.json';
import countriesZhTW from '@/data/countries.zh_TW.json';

export interface LocationType {
  value: string;
  text: string;
}

const tables: Record<string, Record<string, string>> = {
  zh_TW: countriesZhTW,
  en_US: countriesEnUS,
};

export function getCountries(language: string): LocationType[] {
  const table = tables[language] ?? tables.zh_TW;
  const collator = new Intl.Collator(language.replace('_', '-'));
  const list = Object.entries(table)
    .map(([value, text]) => ({ value, text }))
    .sort((a, b) => collator.compare(a.text, b.text));

  const twnIndex = list.findIndex((c) => c.value === 'TWN');
  if (twnIndex > 0) list.unshift(list.splice(twnIndex, 1)[0]);

  return list;
}

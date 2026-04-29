export interface LocationType {
  value: string;
  text: string;
}

async function loadTable(language: string): Promise<Record<string, string>> {
  if (language === 'en_US') {
    return (await import('@/data/countries.en_US.json')).default;
  }
  return (await import('@/data/countries.zh_TW.json')).default;
}

export async function getCountries(language: string): Promise<LocationType[]> {
  const table = await loadTable(language);
  const collator = new Intl.Collator(language.replace('_', '-'));
  const list = Object.entries(table)
    .map(([value, text]) => ({ value, text }))
    .sort((a, b) => collator.compare(a.text, b.text));

  const twnIndex = list.findIndex((c) => c.value === 'TWN');
  if (twnIndex > 0) list.unshift(list.splice(twnIndex, 1)[0]);

  return list;
}

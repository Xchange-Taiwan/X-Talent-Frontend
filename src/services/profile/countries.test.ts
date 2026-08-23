import { describe, expect, it } from 'vitest';

import { getCountries } from './countries';

describe('countries service tests', () => {
  it('correctly loads and sorts countries with TWN at the top for zh_TW', async () => {
    const list = await getCountries('zh_TW');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].value).toBe('TWN');
  });

  it('correctly loads and sorts countries with TWN at the top for en_US', async () => {
    const list = await getCountries('en_US');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].value).toBe('TWN');
  });

  it('throws an AbortError DOMException if passed an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(getCountries('zh_TW', controller.signal)).rejects.toThrowError(
      new DOMException('Aborted', 'AbortError')
    );
  });
});

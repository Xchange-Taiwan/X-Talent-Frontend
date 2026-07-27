import { describe, expect, it } from 'vitest';

import { enumToOptionsArray } from './utils';

describe('enumToOptionsArray', () => {
  it('converts a string enum to { value, label } array', () => {
    enum Color {
      RED = '紅色',
      GREEN = '綠色',
      BLUE = '藍色',
    }

    const result = enumToOptionsArray(Color);

    expect(result).toEqual([
      { value: 'RED', label: '紅色' },
      { value: 'GREEN', label: '綠色' },
      { value: 'BLUE', label: '藍色' },
    ]);
  });

  it('handles empty enum/object', () => {
    const result = enumToOptionsArray({});
    expect(result).toEqual([]);
  });
});

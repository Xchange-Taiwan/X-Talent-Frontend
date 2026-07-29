import { describe, expect, it } from 'vitest';

import {
  ColorToken,
  generateCssString,
} from '../../../scripts/generate-tokens';

describe('generateCssString', () => {
  it('should generate valid CSS block with custom banner and footer', () => {
    const mockTokens: Record<string, ColorToken> = {
      'color-test-primary': { value: '200 10% 50%', comment: '#mockcomment' },
      'color-test-secondary': { value: '100 20% 80%' },
    };

    const cssResult = generateCssString(mockTokens);

    // Verify banner and footer are correctly wrapped
    expect(cssResult).toContain('@layer base {');
    expect(cssResult).toContain(':root {');
    expect(cssResult).toContain('}');

    // Verify token formatting with comment
    expect(cssResult).toContain(
      '    --color-test-primary: 200 10% 50%; /* #mockcomment */\n'
    );

    // Verify token formatting without comment
    expect(cssResult).toContain('    --color-test-secondary: 100 20% 80%;\n');
  });

  it('should output empty root when no tokens are provided', () => {
    const mockTokens: Record<string, ColorToken> = {};
    const cssResult = generateCssString(mockTokens);

    expect(cssResult).toContain(':root {\n  }');
  });
});

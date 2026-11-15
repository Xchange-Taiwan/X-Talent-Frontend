import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildTailwindColors,
  colorTokenGroups,
  rawColors,
  renderTokensCss,
  semanticColorTokens,
} from '../src/design/tokens/color-values.ts';
import tailwindConfig from '../tailwind.config.js';
import * as tokenGenerator from './generate-tokens.mjs';

const {
  extractGlobalCssColorMetadata,
  extractTokensCssVariables,
  flattenTailwindColorScale,
  generateCSS,
  normalizeCSS,
  verifyTokenParity,
} = tokenGenerator;

const TOKENS_CSS_PATH = path.resolve('src/styles/tokens.css');
const GLOBAL_CSS_PATH = path.resolve('src/styles/global.css');
const RETIRED_COLOR_TS_PATH = path.resolve('src/design/tokens/color.ts');

describe('Design Token Generator & Parity Suite (#903)', () => {
  describe('normalizeCSS()', () => {
    it('normalizes CRLF (Windows) and LF (Linux) newlines deterministically', () => {
      const crlfContent = ':root {\r\n  --color-brand: 180 50% 50%;\r\n}\r\n';
      const lfContent = ':root {\n  --color-brand: 180 50% 50%;\n}\n';

      expect(normalizeCSS(crlfContent)).toBe(normalizeCSS(lfContent));
      expect(normalizeCSS(crlfContent)).toBe(
        ':root {\n  --color-brand: 180 50% 50%;\n}'
      );
    });
  });

  describe('Architecture & Retired Legacy Files', () => {
    it('retires the regex line-parser and hand-duplicated src/design/tokens/color.ts', () => {
      expect('parseTSContent' in tokenGenerator).toBe(false);
      expect(fs.existsSync(RETIRED_COLOR_TS_PATH)).toBe(false);
    });

    it('renders tokens.css identically regardless of TS source formatting', () => {
      const customGroups = [
        {
          comment: 'Multi-line Wrapped Token Fixture',
          tokens: {
            'surface-elevated-card': {
              hsl: '210 20% 98%',
              hex: '#f8fafc',
              tailwindPath: ['surface', 'elevated-card'],
            },
          },
        },
      ];

      const css = generateCSS(customGroups);
      expect(css).toContain('/* Multi-line Wrapped Token Fixture */');
      expect(css).toContain(
        '--color-surface-elevated-card: 210 20% 98%; /* #F8FAFC */'
      );
    });
  });

  describe('Live Repository 4-Way Parity (Canonical Registry <-> tokens.css <-> global.css <-> tailwind.config.js)', () => {
    it('verifies 100% parity across canonical registry, tokens.css, global.css, and tailwind.config.js theme.colors', () => {
      const tokensCss = fs.readFileSync(TOKENS_CSS_PATH, 'utf8');
      const globalCss = fs.readFileSync(GLOBAL_CSS_PATH, 'utf8');

      expect(normalizeCSS(tokensCss)).toBe(normalizeCSS(renderTokensCss()));
      expect(tailwindConfig.theme.colors).toEqual(buildTailwindColors());
      expect(tailwindConfig.theme.colors.background.DEFAULT).toBe(
        'hsl(var(--background) / <alpha-value>)'
      );

      const parity = verifyTokenParity({
        tokensCss,
        globalCss,
        tailwindColors: tailwindConfig.theme.colors,
        groups: colorTokenGroups,
        rawColorMap: rawColors,
        semanticTokens: semanticColorTokens,
      });

      expect(parity.errors).toEqual([]);
      expect(parity.ok).toBe(true);
    });

    it('ensures every non-keyword entry in tailwind.config.js theme.colors supports / <alpha-value>', () => {
      const flatColors = flattenTailwindColorScale(tailwindConfig.theme.colors);
      expect(flatColors.get('transparent')).toBe('transparent');
      expect(flatColors.get('current')).toBe('currentColor');
      expect(flatColors.get('background.DEFAULT')).toBe(
        'hsl(var(--background) / <alpha-value>)'
      );

      for (const [colorPath, cssExpr] of flatColors.entries()) {
        if (colorPath === 'transparent' || colorPath === 'current') {
          continue;
        }
        expect(
          cssExpr,
          `Expected theme.colors.${colorPath} to include / <alpha-value>`
        ).toMatch(/^hsl\(var\(--[a-z0-9-]+\) \/ <alpha-value>\)$/);
      }
    });
  });

  describe('verifyTokenParity() Drift Detection', () => {
    const validTokensCss = fs.readFileSync(TOKENS_CSS_PATH, 'utf8');
    const validGlobalCss = fs.readFileSync(GLOBAL_CSS_PATH, 'utf8');
    const validTailwindColors = buildTailwindColors();

    it('detects HSL value drift, unbacked custom properties, or resurrected retired color.ts', () => {
      const driftedTokensCss = validTokensCss.replace(
        '--color-brand-500: 180 64% 48%;',
        '--color-brand-500: 180 64% 40%;\n  --color-rogue-token: 0 0% 0%;'
      );

      const result = verifyTokenParity({
        tokensCss: driftedTokensCss,
        globalCss: validGlobalCss,
        tailwindColors: validTailwindColors,
        retiredColorTsExists: true,
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('--color-brand-500'),
          expect.stringContaining('--color-rogue-token'),
          expect.stringContaining('Retired duplicate color map'),
        ])
      );
    });

    it('detects missing, mismatched, unregistered, or dangling semantic variables in global.css (ignoring CSS comments)', () => {
      const driftedGlobalCss = `
        /* --commented-out: var(--color-does-not-exist); */
        :root {
          --background: var(--color-background-bottom);
          --unregistered-semantic: var(--color-brand-500);
          --bg-custom-gradient: linear-gradient(
            90deg,
            hsl(var(--color-deleted-stop)) 0%,
            hsl(var(--color-brand-500)) 100%
          );
        }
      `;

      const result = verifyTokenParity({
        tokensCss: validTokensCss,
        globalCss: driftedGlobalCss,
        tailwindColors: validTailwindColors,
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('semantic variable "--background" drifted'),
          expect.stringContaining('missing semantic color variable "--primary"'),
          expect.stringContaining(
            'unregistered semantic color alias "--unregistered-semantic'
          ),
          expect.stringContaining(
            'unknown color token "var(--color-deleted-stop)"'
          ),
        ])
      );
      expect(
        result.errors.some((msg) => msg.includes('does-not-exist'))
      ).toBe(false);
    });

    it('detects missing / <alpha-value> (e.g. broken bg-background/80) or extra keys in tailwind.config.js theme.colors', () => {
      const brokenTailwindColors = structuredClone(validTailwindColors);
      brokenTailwindColors.background.DEFAULT = 'hsl(var(--background))';
      brokenTailwindColors.rogueColor =
        'hsl(var(--color-brand-500) / <alpha-value>)';

      const result = verifyTokenParity({
        tokensCss: validTokensCss,
        globalCss: validGlobalCss,
        tailwindColors: brokenTailwindColors,
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'theme.colors mismatch at "background.DEFAULT"'
          ),
          expect.stringContaining(
            'missing "/ <alpha-value>" HSL opacity modifier support'
          ),
          expect.stringContaining('unexpected color key "rogueColor"'),
        ])
      );
    });

    it('extracts tokens.css and global.css metadata accurately across comments and multi-line declarations', () => {
      const { variables, duplicateKeys } = extractTokensCssVariables(`
        :root {
          --color-brand-500: 180 64% 48%; /* #2CCBCB */
          --color-brand-500: 180 64% 48%;
        }
      `);
      expect(variables.get('brand-500')).toBe('180 64% 48%');
      expect(duplicateKeys).toEqual(['brand-500']);

      const { rootDeclarations, colorVarReferences } =
        extractGlobalCssColorMetadata(validGlobalCss);
      expect(rootDeclarations.get('background')).toBe(
        'var(--color-background-white)'
      );
      expect(rootDeclarations.get('radius')).toBe('0.5rem');
      expect(colorVarReferences.has('auth-gradient-1')).toBe(true);
      expect(colorVarReferences.has('mentor-hero-gradient-4')).toBe(true);
    });
  });
});

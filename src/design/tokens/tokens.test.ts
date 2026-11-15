import { describe, expect, it } from 'vitest';

import {
  buildTailwindColors,
  colorTokenGroups,
  colorTokens,
  formatTailwindCssVarColor,
  hexColors,
  rawColors,
  renderTokensCss,
  resolveTailwindColorPath,
  semanticColorTokens,
  type TailwindColorScale,
} from './color-values';
// @ts-expect-error - font.ts is a CommonJS module
import fonts from './font';
// @ts-expect-error - shadow.ts is a CommonJS module
import shadows from './shadow';

function getScaleValue(
  scale: TailwindColorScale,
  pathSegments: readonly string[]
): string | undefined {
  let current: string | TailwindColorScale | undefined = scale;
  for (const segment of pathSegments) {
    if (typeof current !== 'object' || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

describe('Design Tokens Configuration', () => {
  const colors = buildTailwindColors();

  describe('Canonical color registry and builders', () => {
    it('exports matching raw HSL and HEX maps for every canonical color token', () => {
      const tokenKeys = Object.keys(colorTokens);
      expect(tokenKeys.length).toBe(69);
      expect(Object.keys(rawColors)).toEqual(tokenKeys);
      expect(Object.keys(hexColors)).toEqual(tokenKeys);

      expect(rawColors['brand-500']).toBe('180 64% 48%');
      expect(hexColors['brand-500']).toBe('#2CCBCB');
      expect(colorTokens['brand-500']).toEqual({
        hsl: '180 64% 48%',
        hex: '#2CCBCB',
      });
    });

    it('should have the auth gradient stop colors in raw colors and Tailwind scale', () => {
      expect(rawColors['auth-gradient-1']).toBe('180 63% 95%');
      expect(rawColors['auth-gradient-2']).toBe('200 100% 91%');
      expect(rawColors['auth-gradient-3']).toBe('253 100% 95%');

      expect(getScaleValue(colors, ['auth-gradient', '1'])).toBe(
        'hsl(var(--color-auth-gradient-1) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['auth-gradient', '2'])).toBe(
        'hsl(var(--color-auth-gradient-2) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['auth-gradient', '3'])).toBe(
        'hsl(var(--color-auth-gradient-3) / <alpha-value>)'
      );
    });

    it('should have the mentor hero gradient stop colors in raw colors and Tailwind scale', () => {
      expect(rawColors['mentor-hero-gradient-1']).toBe('60 100% 97%');
      expect(rawColors['mentor-hero-gradient-2']).toBe('300 100% 98%');
      expect(rawColors['mentor-hero-gradient-3']).toBe('273 53% 97%');
      expect(rawColors['mentor-hero-gradient-4']).toBe('180 100% 95%');

      expect(getScaleValue(colors, ['mentor-hero-gradient', '1'])).toBe(
        'hsl(var(--color-mentor-hero-gradient-1) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['mentor-hero-gradient', '2'])).toBe(
        'hsl(var(--color-mentor-hero-gradient-2) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['mentor-hero-gradient', '3'])).toBe(
        'hsl(var(--color-mentor-hero-gradient-3) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['mentor-hero-gradient', '4'])).toBe(
        'hsl(var(--color-mentor-hero-gradient-4) / <alpha-value>)'
      );
    });

    it('should expose warm-yellow status warning surface, border, and text tokens (#734)', () => {
      expect(rawColors['status-warning-surface']).toBe('39 100% 95%');
      expect(rawColors['status-warning-border']).toBe('39 82% 84%');
      expect(rawColors['status-warning-text']).toBe('39 100% 27%');

      expect(getScaleValue(colors, ['status', 'warning', 'surface'])).toBe(
        'hsl(var(--color-status-warning-surface) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['status', 'warning', 'border'])).toBe(
        'hsl(var(--color-status-warning-border) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['status', 'warning', 'text'])).toBe(
        'hsl(var(--color-status-warning-text) / <alpha-value>)'
      );
    });

    it('preserves legacy camelCase landing tokens and compound background keys', () => {
      expect(getScaleValue(colors, ['navy'])).toBe(
        'hsl(var(--color-navy) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['logoBlue'])).toBe(
        'hsl(var(--color-logo-blue) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['bdBlue'])).toBe(
        'hsl(var(--color-bd-blue) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['marketingOrange'])).toBe(
        'hsl(var(--color-marketing-orange) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['landingPurpleLight'])).toBe(
        'hsl(var(--color-landing-purple-light) / <alpha-value>)'
      );
      expect(getScaleValue(colors, ['background', 'bottom-secondary'])).toBe(
        'hsl(var(--color-background-bottom-secondary) / <alpha-value>)'
      );
    });

    it('includes / <alpha-value> on background.DEFAULT and every semantic CSS variable alias (#903)', () => {
      expect(getScaleValue(colors, ['background', 'DEFAULT'])).toBe(
        'hsl(var(--background) / <alpha-value>)'
      );

      for (const [semanticKey, semanticDef] of Object.entries(
        semanticColorTokens
      )) {
        expect(rawColors[semanticDef.aliasOf]).toBeDefined();
        expect(getScaleValue(colors, semanticDef.tailwindPath)).toBe(
          `hsl(var(--${semanticKey}) / <alpha-value>)`
        );
      }
    });

    it('renders deterministic tokens.css output and validates malformed token inputs', () => {
      const renderedFirst = renderTokensCss(colorTokenGroups);
      const renderedSecond = renderTokensCss(colorTokenGroups);
      expect(renderedFirst).toBe(renderedSecond);
      expect(renderedFirst).toContain(
        '--color-background-white: 0 0% 100%; /* #FFFFFF */'
      );

      expect(() =>
        renderTokensCss([
          {
            comment: 'Invalid Key',
            tokens: {
              text_primary: { hsl: '225 12% 13%', hex: '#1E2026' },
            },
          },
        ])
      ).toThrow(/Invalid color token key/);

      expect(() =>
        renderTokensCss([
          {
            comment: 'Invalid HSL',
            tokens: {
              'text-primary': { hsl: '#1E2026', hex: '#1E2026' },
            },
          },
        ])
      ).toThrow(/Invalid HSL channel value/);

      expect(() =>
        renderTokensCss([
          {
            comment: 'Invalid HEX',
            tokens: {
              'text-primary': { hsl: '225 12% 13%', hex: '1E2026' },
            },
          },
        ])
      ).toThrow(/Invalid HEX value/);

      expect(() =>
        renderTokensCss([
          {
            tokens: { 'brand-500': { hsl: '180 64% 48%', hex: '#2CCBCB' } },
          },
          {
            tokens: { 'brand-500': { hsl: '180 64% 48%', hex: '#2CCBCB' } },
          },
        ])
      ).toThrow(/Duplicate color token key/);

      expect(() =>
        renderTokensCss([
          {
            comment: 'Broken */ comment',
            tokens: { 'brand-500': { hsl: '180 64% 48%', hex: '#2CCBCB' } },
          },
        ])
      ).toThrow(/Invalid color token group comment/);
    });

    it('guards against colliding Tailwind paths and unknown semantic aliases', () => {
      expect(() =>
        buildTailwindColors({
          groups: [
            {
              tokens: {
                'surface-base': { hsl: '0 0% 100%', hex: '#FFFFFF' },
                'surface-base-muted': { hsl: '0 0% 96%', hex: '#F5F5F5' },
              },
            },
          ],
          semanticTokens: {},
        })
      ).toThrow(/Tailwind color path collision/);

      expect(() =>
        buildTailwindColors({
          groups: [
            {
              tokens: {
                'brand-500': { hsl: '180 64% 48%', hex: '#2CCBCB' },
              },
            },
          ],
          semanticTokens: {
            primary: {
              aliasOf: 'nonexistent-token',
              tailwindPath: ['primary', 'DEFAULT'],
            },
          },
        })
      ).toThrow(/aliases unknown raw color token/);

      expect(() => formatTailwindCssVarColor('bad_var')).toThrow(
        /Invalid CSS custom property name/
      );
      expect(resolveTailwindColorPath('brand-500')).toEqual(['brand', '500']);
    });
  });

  describe('Shadow values', () => {
    it('should have the shadow-card token defined in shadow.ts', () => {
      expect(shadows.card).toBe('0 2px 12px rgba(0, 0, 0, 0.04)');
    });
  });

  describe('Font values', () => {
    it('should have the openSans token with a reasonable fallback stack', () => {
      expect(fonts.openSans).toEqual([
        "'Open Sans'",
        'ui-sans-serif',
        'system-ui',
        'sans-serif',
      ]);
    });
  });
});

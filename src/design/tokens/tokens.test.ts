import { describe, expect, it } from 'vitest';

// @ts-expect-error - color.ts is a CommonJS module
import colors from './color';
import { rawColors } from './color-values';
// @ts-expect-error - shadow.ts is a CommonJS module
import shadows from './shadow';

describe('Design Tokens Configuration', () => {
  describe('Color values and mapping', () => {
    it('should have the new auth gradient stop colors in raw colors', () => {
      expect(rawColors['auth-gradient-1']).toBe('180 63% 95%');
      expect(rawColors['auth-gradient-2']).toBe('200 100% 91%');
      expect(rawColors['auth-gradient-3']).toBe('253 100% 95%');
    });

    it('should have the new mentor hero gradient stop colors in raw colors', () => {
      expect(rawColors['mentor-hero-gradient-1']).toBe('60 100% 97%');
      expect(rawColors['mentor-hero-gradient-2']).toBe('300 100% 98%');
      expect(rawColors['mentor-hero-gradient-3']).toBe('273 53% 97%');
      expect(rawColors['mentor-hero-gradient-4']).toBe('180 100% 95%');
    });

    it('should correctly map raw colors into the Tailwind color export', () => {
      expect(colors['auth-gradient']).toBeDefined();
      expect(colors['auth-gradient'][1]).toBe(
        'hsl(var(--color-auth-gradient-1) / <alpha-value>)'
      );
      expect(colors['auth-gradient'][2]).toBe(
        'hsl(var(--color-auth-gradient-2) / <alpha-value>)'
      );
      expect(colors['auth-gradient'][3]).toBe(
        'hsl(var(--color-auth-gradient-3) / <alpha-value>)'
      );
    });

    it('should correctly map mentor hero gradient raw colors into the Tailwind color export', () => {
      expect(colors['mentor-hero-gradient']).toBeDefined();
      expect(colors['mentor-hero-gradient'][1]).toBe(
        'hsl(var(--color-mentor-hero-gradient-1) / <alpha-value>)'
      );
      expect(colors['mentor-hero-gradient'][2]).toBe(
        'hsl(var(--color-mentor-hero-gradient-2) / <alpha-value>)'
      );
      expect(colors['mentor-hero-gradient'][3]).toBe(
        'hsl(var(--color-mentor-hero-gradient-3) / <alpha-value>)'
      );
      expect(colors['mentor-hero-gradient'][4]).toBe(
        'hsl(var(--color-mentor-hero-gradient-4) / <alpha-value>)'
      );
    });
  });

  describe('Shadow values', () => {
    it('should have the shadow-card token defined in shadow.ts', () => {
      expect(shadows.card).toBe('0 2px 12px rgba(0, 0, 0, 0.04)');
    });
  });
});

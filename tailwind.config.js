// eslint-disable-next-line @typescript-eslint/no-var-requires
const colors = require('./src/design/tokens/color');

export const content = ['./src/**/*.{js,jsx,ts,tsx}'];

export const theme = {
  container: {
    center: true,
    padding: '2rem',
    screens: {
      '2xl': '1400px',
    },
  },
  colors,
  extend: {
    fontSize: {
      11: ['11px', { lineHeight: '1' }],
      13: ['13px', { lineHeight: '1' }],
      14: ['14px', { lineHeight: '1.4' }],
      18: ['18px', { lineHeight: '1.4' }],
      28: ['28px', { lineHeight: '1' }],
      32: ['32px', { lineHeight: '1.25' }],
      36: ['36px', { lineHeight: '1.25' }],
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
    keyframes: {
      'accordion-down': {
        from: { height: 0 },
        to: { height: 'var(--radix-accordion-content-height)' },
      },
      'accordion-up': {
        from: { height: 'var(--radix-accordion-content-height)' },
        to: { height: 0 },
      },
    },
    animation: {
      'accordion-down': 'accordion-down 0.2s ease-out',
      'accordion-up': 'accordion-up 0.2s ease-out',
    },
  },
};
export const plugins = [require('tailwindcss-animate')];

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colors = require('./src/design/tokens/color');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shadows = require('./src/design/tokens/shadow');

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
    boxShadow: {
      card: shadows.card,
    },
    backgroundImage: {
      'auth-card': 'var(--bg-auth-card)',
      'mentor-hero': 'var(--bg-mentor-hero)',
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
      // Stays invisible for the first ~150ms, then fades in. Applied to
      // loading skeletons so a fast load (content ready before the delay
      // elapses) never flashes the skeleton at all - only genuinely slow
      // loads make it visible.
      'delayed-fade-in': {
        '0%, 50%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
    },
    animation: {
      'accordion-down': 'accordion-down 0.2s ease-out',
      'accordion-up': 'accordion-up 0.2s ease-out',
      'delayed-fade-in': 'delayed-fade-in 0.3s ease-in forwards',
    },
  },
};
export const plugins = [require('tailwindcss-animate')];

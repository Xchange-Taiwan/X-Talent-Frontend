// eslint-disable-next-line @typescript-eslint/no-var-requires
const colors = require('./src/design/tokens/color');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shadows = require('./src/design/tokens/shadow');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fonts = require('./src/design/tokens/font');

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
    fontFamily: {
      'open-sans': fonts.openSans,
    },
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
      'card-hover': shadows.cardHover,
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
      'feedback-overlay-in': {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
      'feedback-dialog-in': {
        from: { opacity: '0', transform: 'translateY(4px) scale(0.985)' },
        to: { opacity: '1', transform: 'translateY(0) scale(1)' },
      },
      'feedback-step-in': {
        from: { opacity: '0', transform: 'translateY(5px)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      'feedback-card-out': {
        from: { opacity: '1', transform: 'translateX(0) rotate(0deg)' },
        to: { opacity: '0', transform: 'translateX(-100px) rotate(-8deg)' },
      },
      'feedback-card-promote': {
        from: {
          opacity: '0.65',
          transform: 'translateY(12px) rotate(-5deg) scale(0.96)',
        },
        to: {
          opacity: '1',
          transform: 'translateY(0) rotate(0deg) scale(1)',
        },
      },
    },
    animation: {
      'accordion-down': 'accordion-down 0.2s ease-out',
      'accordion-up': 'accordion-up 0.2s ease-out',
      'delayed-fade-in': 'delayed-fade-in 0.3s ease-in forwards',
      'feedback-overlay-in': 'feedback-overlay-in 160ms ease-out',
      'feedback-dialog-in':
        'feedback-dialog-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      'feedback-step-in':
        'feedback-step-in 240ms cubic-bezier(0.22, 0.75, 0.25, 1) both',
      'feedback-card-out':
        'feedback-card-out 260ms cubic-bezier(0.22, 0.75, 0.25, 1) forwards',
      'feedback-card-promote':
        'feedback-card-promote 360ms cubic-bezier(0.22, 0.75, 0.25, 1) both',
    },
  },
};
export const plugins = [require('tailwindcss-animate')];

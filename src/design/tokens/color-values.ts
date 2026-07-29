/**
 * This file is the single source of truth for raw design token color values.
 * Regenerate CSS custom properties by running: pnpm generate:tokens
 */
export const rawColors = {
  // Color System Tokens
  'text-primary': '225 12% 13%', // #1E2026
  'text-secondary': '218 10% 31%', // #474D57
  'text-tertiary': '216 10% 51%', // #76808F
  'text-disable': '214 9% 71%', // #AEB4BC
  'text-white': '0 0% 100%', // #FFFFFF
  'background-bottom': '0 0% 96%', // #F5F5F5
  'background-bottom-secondary': '0 0% 98%', // #FAFAFA
  'background-white': '0 0% 100%', // #FFFFFF
  'background-border': '210 9% 91%', // #E6E8EA
  'brand-50': '180 62% 95%', // #EAFAFA
  'brand-100': '180 62% 90%', // #D5F5F5
  'brand-200': '180 60% 79%', // #ABEAEA
  'brand-300': '180 61% 69%', // #80E0E0
  'brand-400': '180 60% 59%', // #56D5D5
  'brand-500': '180 64% 48%', // #2CCBCB
  'brand-600': '180 64% 39%', // #23A2A2
  'brand-700': '180 65% 29%', // #1A7A7A
  'brand-800': '180 64% 19%', // #125151
  'brand-900': '180 64% 10%', // #092929
  'gray-100': '0 0% 91%', // #E9E9E9
  'gray-200': '0 0% 82%', // #D2D2D2
  'gray-300': '0 0% 74%', // #BCBCBC
  'gray-400': '0 0% 65%', // #A5A5A5
  'gray-500': '0 0% 56%', // #8F8F8F
  'gray-600': '0 0% 45%', // #727272
  'gray-700': '0 0% 34%', // #565656
  'gray-800': '0 0% 22%', // #393939
  'gray-900': '0 0% 11%', // #1D1D1D
  'status-success-default': '137 100% 36%', // #00BA34
  'status-success-active': '137 62% 48%', // #2EC659
  'status-error-default': '11 87% 50%', // #EE3911
  'status-error-active': '11 87% 59%', // #F15D3C
  'status-warning-default': '47 87% 50%', // #EEBE11
  'status-warning-active': '47 87% 59%', // #F1CA3C
  'status-info-default': '29 87% 50%', // #EE7C11
  'status-info-active': '29 87% 59%', // #F1943C
  'blue-default': '190 100% 68%', // #5DE5FF
  'blue-active': '190 100% 80%', // #97EEFF
  'pink-default': '340 100% 69%', // #FF6397
  'pink-active': '340 100% 80%', // #FF9BBD
  'jade-default': '162 84% 62%', // #4BEFBD
  'jade-active': '162 84% 75%', // #8CF5D5
  'lime-default': '49 100% 65%', // #FFDE4E
  'lime-active': '49 100% 78%', // #FFEA8D
  'orange-default': '29 100% 67%', // #FFA957
  'orange-active': '29 100% 79%', // #FFC894
  'purple-default': '274 96% 67%', // #B55AFC
  'purple-active': '274 96% 79%', // #D095FD
  light: '0 0% 100%', // #FFFFFF
  dark: '0 0% 16%', // #282828
  'avatar-background': '180 57% 97%', // #F4FCFC
  'avatar-border': '180 16% 76%', // #B7CBCB
  'avatar-overlay': '0 0% 44%', // #6F6F6F

  // Legacy / Landing page specific colors
  navy: '219 59% 22%', // #172E59
  'logo-blue': '200 100% 18%', // #003C5A
  'bd-blue': '212 100% 74%', // #7CB8FF
  'marketing-orange': '29 100% 75%', // #FFBF82
  'landing-purple-light': '270 33% 96%', // #F7F2FB
} as const;

export type RawColorKey = keyof typeof rawColors;

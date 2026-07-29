export interface ColorToken {
  value: string;
  comment?: string;
}

export const colorValues: Record<string, ColorToken> = {
  // Color System Tokens - Text
  'color-text-primary': { value: '225 12% 13%', comment: '#1E2026' },
  'color-text-secondary': { value: '218 10% 31%', comment: '#474D57' },
  'color-text-tertiary': { value: '216 10% 51%', comment: '#76808F' },
  'color-text-disable': { value: '214 9% 71%', comment: '#AEB4BC' },
  'color-text-white': { value: '0 0% 100%', comment: '#FFFFFF' },

  // Color System Tokens - Background
  'color-background-bottom': { value: '0 0% 96%', comment: '#F5F5F5' },
  'color-background-bottom-secondary': {
    value: '0 0% 98%',
    comment: '#FAFAFA',
  },
  'color-background-white': { value: '0 0% 100%', comment: '#FFFFFF' },
  'color-background-border': { value: '210 9% 91%', comment: '#E6E8EA' },

  // Color System Tokens - Brand
  'color-brand-50': { value: '180 62% 95%', comment: '#EAFAFA' },
  'color-brand-100': { value: '180 62% 90%', comment: '#D5F5F5' },
  'color-brand-200': { value: '180 60% 79%', comment: '#ABEAEA' },
  'color-brand-300': { value: '180 61% 69%', comment: '#80E0E0' },
  'color-brand-400': { value: '180 60% 59%', comment: '#56D5D5' },
  'color-brand-500': { value: '180 64% 48%', comment: '#2CCBCB' },
  'color-brand-600': { value: '180 64% 39%', comment: '#23A2A2' },
  'color-brand-700': { value: '180 65% 29%', comment: '#1A7A7A' },
  'color-brand-800': { value: '180 64% 19%', comment: '#125151' },
  'color-brand-900': { value: '180 64% 10%', comment: '#092929' },

  // Color System Tokens - Gray
  'color-gray-100': { value: '0 0% 91%', comment: '#E9E9E9' },
  'color-gray-200': { value: '0 0% 82%', comment: '#D2D2D2' },
  'color-gray-300': { value: '0 0% 74%', comment: '#BCBCBC' },
  'color-gray-400': { value: '0 0% 65%', comment: '#A5A5A5' },
  'color-gray-500': { value: '0 0% 56%', comment: '#8F8F8F' },
  'color-gray-600': { value: '0 0% 45%', comment: '#727272' },
  'color-gray-700': { value: '0 0% 34%', comment: '#565656' },
  'color-gray-800': { value: '0 0% 22%', comment: '#393939' },
  'color-gray-900': { value: '0 0% 11%', comment: '#1D1D1D' },

  // Color System Tokens - Status
  'color-status-success-default': { value: '137 100% 36%', comment: '#00BA34' },
  'color-status-success-active': { value: '137 62% 48%', comment: '#2EC659' },
  'color-status-error-default': { value: '11 87% 50%', comment: '#EE3911' },
  'color-status-error-active': { value: '11 87% 59%', comment: '#F15D3C' },
  'color-status-warning-default': { value: '47 87% 50%', comment: '#EEBE11' },
  'color-status-warning-active': { value: '47 87% 59%', comment: '#F1CA3C' },
  'color-status-info-default': { value: '29 87% 50%', comment: '#EE7C11' },
  'color-status-info-active': { value: '29 87% 59%', comment: '#F1943C' },

  // Color System Tokens - Others
  'color-blue-default': { value: '190 100% 68%', comment: '#5DE5FF' },
  'color-blue-active': { value: '190 100% 80%', comment: '#97EEFF' },
  'color-pink-default': { value: '340 100% 69%', comment: '#FF6397' },
  'color-pink-active': { value: '340 100% 80%', comment: '#FF9BBD' },
  'color-jade-default': { value: '162 84% 62%', comment: '#4BEFBD' },
  'color-jade-active': { value: '162 84% 75%', comment: '#8CF5D5' },
  'color-lime-default': { value: '49 100% 65%', comment: '#FFDE4E' },
  'color-lime-active': { value: '49 100% 78%', comment: '#FFEA8D' },
  'color-orange-default': { value: '29 100% 67%', comment: '#FFA957' },
  'color-orange-active': { value: '29 100% 79%', comment: '#FFC894' },
  'color-purple-default': { value: '274 96% 67%', comment: '#B55AFC' },
  'color-purple-active': { value: '274 96% 79%', comment: '#D095FD' },
  'color-light': { value: '0 0% 100%', comment: '#FFFFFF' },
  'color-dark': { value: '0 0% 16%', comment: '#282828' },
  'color-avatar-background': { value: '180 57% 97%', comment: '#F4FCFC' },
  'color-avatar-border': { value: '180 16% 76%', comment: '#B7CBCB' },
  'color-avatar-overlay': { value: '0 0% 44%', comment: '#6F6F6F' },

  // Legacy / Landing page specific colors
  'color-navy': { value: '219 59% 22%', comment: '#172E59' },
  'color-logo-blue': { value: '200 100% 18%', comment: '#003C5A' },
  'color-bd-blue': { value: '212 100% 74%', comment: '#7CB8FF' },
  'color-marketing-orange': { value: '29 100% 75%', comment: '#FFBF82' },
  'color-landing-purple-light': { value: '270 33% 96%', comment: '#F7F2FB' },
};

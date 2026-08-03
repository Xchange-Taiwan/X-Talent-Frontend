module.exports = {
  transparent: 'transparent',
  current: 'currentColor',
  text: {
    primary: 'hsl(var(--color-text-primary) / <alpha-value>)',
    secondary: 'hsl(var(--color-text-secondary) / <alpha-value>)',
    tertiary: 'hsl(var(--color-text-tertiary) / <alpha-value>)',
    disable: 'hsl(var(--color-text-disable) / <alpha-value>)',
    white: 'hsl(var(--color-text-white) / <alpha-value>)',
  },
  background: {
    DEFAULT: 'hsl(var(--background))',
    bottom: 'hsl(var(--color-background-bottom) / <alpha-value>)',
    'bottom-secondary':
      'hsl(var(--color-background-bottom-secondary) / <alpha-value>)',
    white: 'hsl(var(--color-background-white) / <alpha-value>)',
    border: 'hsl(var(--color-background-border) / <alpha-value>)',
  },
  brand: {
    50: 'hsl(var(--color-brand-50) / <alpha-value>)',
    100: 'hsl(var(--color-brand-100) / <alpha-value>)',
    200: 'hsl(var(--color-brand-200) / <alpha-value>)',
    300: 'hsl(var(--color-brand-300) / <alpha-value>)',
    400: 'hsl(var(--color-brand-400) / <alpha-value>)',
    500: 'hsl(var(--color-brand-500) / <alpha-value>)',
    600: 'hsl(var(--color-brand-600) / <alpha-value>)',
    700: 'hsl(var(--color-brand-700) / <alpha-value>)',
    800: 'hsl(var(--color-brand-800) / <alpha-value>)',
    900: 'hsl(var(--color-brand-900) / <alpha-value>)',
  },
  gray: {
    100: 'hsl(var(--color-gray-100) / <alpha-value>)',
    200: 'hsl(var(--color-gray-200) / <alpha-value>)',
    300: 'hsl(var(--color-gray-300) / <alpha-value>)',
    400: 'hsl(var(--color-gray-400) / <alpha-value>)',
    500: 'hsl(var(--color-gray-500) / <alpha-value>)',
    600: 'hsl(var(--color-gray-600) / <alpha-value>)',
    700: 'hsl(var(--color-gray-700) / <alpha-value>)',
    800: 'hsl(var(--color-gray-800) / <alpha-value>)',
    900: 'hsl(var(--color-gray-900) / <alpha-value>)',
  },
  status: {
    success: {
      default: 'hsl(var(--color-status-success-default) / <alpha-value>)',
      active: 'hsl(var(--color-status-success-active) / <alpha-value>)',
    },
    error: {
      default: 'hsl(var(--color-status-error-default) / <alpha-value>)',
      active: 'hsl(var(--color-status-error-active) / <alpha-value>)',
    },
    warning: {
      default: 'hsl(var(--color-status-warning-default) / <alpha-value>)',
      active: 'hsl(var(--color-status-warning-active) / <alpha-value>)',
    },
    info: {
      default: 'hsl(var(--color-status-info-default) / <alpha-value>)',
      active: 'hsl(var(--color-status-info-active) / <alpha-value>)',
    },
  },
  blue: {
    default: 'hsl(var(--color-blue-default) / <alpha-value>)',
    active: 'hsl(var(--color-blue-active) / <alpha-value>)',
  },
  pink: {
    default: 'hsl(var(--color-pink-default) / <alpha-value>)',
    active: 'hsl(var(--color-pink-active) / <alpha-value>)',
  },
  jade: {
    default: 'hsl(var(--color-jade-default) / <alpha-value>)',
    active: 'hsl(var(--color-jade-active) / <alpha-value>)',
  },
  lime: {
    default: 'hsl(var(--color-lime-default) / <alpha-value>)',
    active: 'hsl(var(--color-lime-active) / <alpha-value>)',
  },
  orange: {
    default: 'hsl(var(--color-orange-default) / <alpha-value>)',
    active: 'hsl(var(--color-orange-active) / <alpha-value>)',
  },
  purple: {
    default: 'hsl(var(--color-purple-default) / <alpha-value>)',
    active: 'hsl(var(--color-purple-active) / <alpha-value>)',
  },
  light: 'hsl(var(--color-light) / <alpha-value>)',
  dark: 'hsl(var(--color-dark) / <alpha-value>)',
  avatar: {
    background: 'hsl(var(--color-avatar-background) / <alpha-value>)',
    border: 'hsl(var(--color-avatar-border) / <alpha-value>)',
    overlay: 'hsl(var(--color-avatar-overlay) / <alpha-value>)',
  },
  'auth-gradient': {
    1: 'hsl(var(--color-auth-gradient-1) / <alpha-value>)',
    2: 'hsl(var(--color-auth-gradient-2) / <alpha-value>)',
    3: 'hsl(var(--color-auth-gradient-3) / <alpha-value>)',
  },
  'mentor-hero-gradient': {
    1: 'hsl(var(--color-mentor-hero-gradient-1) / <alpha-value>)',
    2: 'hsl(var(--color-mentor-hero-gradient-2) / <alpha-value>)',
    3: 'hsl(var(--color-mentor-hero-gradient-3) / <alpha-value>)',
    4: 'hsl(var(--color-mentor-hero-gradient-4) / <alpha-value>)',
  },
  // [Item 3: Legacy landing-only tokens]
  // 經過全面代碼檢索（grep），以下 5 個 Token 仍被 (landing)/about、(landing)/page、(landing)/terms、(landing)/privacy、mentor-pool/PopularPositionChips 以及 components/landing/HomePageSlider 廣泛調用，為防樣式損壞，依據工程規範維持保留。
  navy: 'hsl(var(--color-navy) / <alpha-value>)',
  logoBlue: 'hsl(var(--color-logo-blue) / <alpha-value>)',
  bdBlue: 'hsl(var(--color-bd-blue) / <alpha-value>)',
  marketingOrange: 'hsl(var(--color-marketing-orange) / <alpha-value>)',
  landingPurpleLight: 'hsl(var(--color-landing-purple-light) / <alpha-value>)',

  // shadcn/ui semantic variable mappings
  border: 'hsl(var(--border) / <alpha-value>)',
  input: 'hsl(var(--input) / <alpha-value>)',
  ring: 'hsl(var(--ring) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
  primary: {
    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
    foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
    foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
    foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
    foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
  },
  card: {
    DEFAULT: 'hsl(var(--card) / <alpha-value>)',
    foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
  },
};

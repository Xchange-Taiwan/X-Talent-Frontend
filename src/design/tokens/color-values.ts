/**
 * Canonical single source of truth for X-Talent color design tokens,
 * semantic CSS variable aliases, `src/styles/tokens.css` compilation, and
 * Tailwind CSS `theme.colors` generation.
 *
 * Consumed directly by:
 * - `scripts/generate-tokens.mjs` (`pnpm generate:tokens` / `--check`)
 * - `tailwind.config.js` (`theme.colors`)
 * - Runtime/Storybook documentation (`src/docs/ColorPalette.tsx`)
 */

export interface ColorTokenDefinition {
  readonly hsl: string;
  readonly hex: string;
  readonly tailwindPath?: readonly [string, ...string[]];
}

export interface ColorTokenGroup {
  readonly comment?: string;
  readonly tokens: Readonly<Record<string, ColorTokenDefinition>>;
}

export type TailwindColorValue = string;

export interface TailwindColorScale {
  [key: string]: TailwindColorValue | TailwindColorScale;
}

const TOKEN_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HSL_CHANNELS_PATTERN =
  /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const colorSystemTokens = {
  'text-primary': { hsl: '225 12% 13%', hex: '#1E2026' },
  'text-secondary': { hsl: '218 10% 31%', hex: '#474D57' },
  'text-tertiary': { hsl: '216 10% 51%', hex: '#76808F' },
  'text-disable': { hsl: '214 9% 71%', hex: '#AEB4BC' },
  'text-white': { hsl: '0 0% 100%', hex: '#FFFFFF' },
  'background-bottom': { hsl: '0 0% 96%', hex: '#F5F5F5' },
  'background-bottom-secondary': {
    hsl: '0 0% 98%',
    hex: '#FAFAFA',
    tailwindPath: ['background', 'bottom-secondary'],
  },
  'background-white': { hsl: '0 0% 100%', hex: '#FFFFFF' },
  'background-border': { hsl: '210 9% 91%', hex: '#E6E8EA' },
  'background-hover': { hsl: '206 31% 96%', hex: '#F2F6F9' },
  'brand-50': { hsl: '180 62% 95%', hex: '#EAFAFA' },
  'brand-100': { hsl: '180 62% 90%', hex: '#D5F5F5' },
  'brand-200': { hsl: '180 60% 79%', hex: '#ABEAEA' },
  'brand-300': { hsl: '180 61% 69%', hex: '#80E0E0' },
  'brand-400': { hsl: '180 60% 59%', hex: '#56D5D5' },
  'brand-500': { hsl: '180 64% 48%', hex: '#2CCBCB' },
  'brand-600': { hsl: '180 64% 39%', hex: '#23A2A2' },
  'brand-700': { hsl: '180 65% 29%', hex: '#1A7A7A' },
  'brand-800': { hsl: '180 64% 19%', hex: '#125151' },
  'brand-900': { hsl: '180 64% 10%', hex: '#092929' },
  'gray-100': { hsl: '0 0% 91%', hex: '#E9E9E9' },
  'gray-200': { hsl: '0 0% 82%', hex: '#D2D2D2' },
  'gray-300': { hsl: '0 0% 74%', hex: '#BCBCBC' },
  'gray-400': { hsl: '0 0% 65%', hex: '#A5A5A5' },
  'gray-500': { hsl: '0 0% 56%', hex: '#8F8F8F' },
  'gray-600': { hsl: '0 0% 45%', hex: '#727272' },
  'gray-700': { hsl: '0 0% 34%', hex: '#565656' },
  'gray-800': { hsl: '0 0% 22%', hex: '#393939' },
  'gray-900': { hsl: '0 0% 11%', hex: '#1D1D1D' },
  'status-success-default': { hsl: '137 100% 36%', hex: '#00BA34' },
  'status-success-active': { hsl: '137 62% 48%', hex: '#2EC659' },
  'status-error-default': { hsl: '11 87% 50%', hex: '#EE3911' },
  'status-error-active': { hsl: '11 87% 59%', hex: '#F15D3C' },
  'status-warning-default': { hsl: '47 87% 50%', hex: '#EEBE11' },
  'status-warning-active': { hsl: '47 87% 59%', hex: '#F1CA3C' },
  'status-warning-surface': { hsl: '39 100% 95%', hex: '#FFF7E6' },
  'status-warning-border': { hsl: '39 82% 84%', hex: '#F6DFB5' },
  'status-warning-text': { hsl: '39 100% 27%', hex: '#8A5A00' },
  'status-info-default': { hsl: '29 87% 50%', hex: '#EE7C11' },
  'status-info-active': { hsl: '29 87% 59%', hex: '#F1943C' },
  'blue-default': { hsl: '190 100% 68%', hex: '#5DE5FF' },
  'blue-active': { hsl: '190 100% 80%', hex: '#97EEFF' },
  'pink-default': { hsl: '340 100% 69%', hex: '#FF6397' },
  'pink-active': { hsl: '340 100% 80%', hex: '#FF9BBD' },
  'jade-default': { hsl: '162 84% 62%', hex: '#4BEFBD' },
  'jade-active': { hsl: '162 84% 75%', hex: '#8CF5D5' },
  'lime-default': { hsl: '49 100% 65%', hex: '#FFDE4E' },
  'lime-active': { hsl: '49 100% 78%', hex: '#FFEA8D' },
  'orange-default': { hsl: '29 100% 67%', hex: '#FFA957' },
  'orange-active': { hsl: '29 100% 79%', hex: '#FFC894' },
  'purple-default': { hsl: '274 96% 67%', hex: '#B55AFC' },
  'purple-active': { hsl: '274 96% 79%', hex: '#D095FD' },
  light: { hsl: '0 0% 100%', hex: '#FFFFFF' },
  dark: { hsl: '0 0% 16%', hex: '#282828' },
  'avatar-background': { hsl: '180 57% 97%', hex: '#F4FCFC' },
  'avatar-border': { hsl: '180 16% 76%', hex: '#B7CBCB' },
  'avatar-overlay': { hsl: '0 0% 44%', hex: '#6F6F6F' },
} as const satisfies Record<string, ColorTokenDefinition>;

const authGradientTokens = {
  'auth-gradient-1': {
    hsl: '180 63% 95%',
    hex: '#EAFBFB',
    tailwindPath: ['auth-gradient', '1'],
  },
  'auth-gradient-2': {
    hsl: '200 100% 91%',
    hex: '#CFEFFF',
    tailwindPath: ['auth-gradient', '2'],
  },
  'auth-gradient-3': {
    hsl: '253 100% 95%',
    hex: '#EAE4FF',
    tailwindPath: ['auth-gradient', '3'],
  },
} as const satisfies Record<string, ColorTokenDefinition>;

const mentorHeroGradientTokens = {
  'mentor-hero-gradient-1': {
    hsl: '60 100% 97%',
    hex: '#FFFFEF',
    tailwindPath: ['mentor-hero-gradient', '1'],
  },
  'mentor-hero-gradient-2': {
    hsl: '300 100% 98%',
    hex: '#FFF6FF',
    tailwindPath: ['mentor-hero-gradient', '2'],
  },
  'mentor-hero-gradient-3': {
    hsl: '273 53% 97%',
    hex: '#F7F2FB',
    tailwindPath: ['mentor-hero-gradient', '3'],
  },
  'mentor-hero-gradient-4': {
    hsl: '180 100% 95%',
    hex: '#E4FFFF',
    tailwindPath: ['mentor-hero-gradient', '4'],
  },
} as const satisfies Record<string, ColorTokenDefinition>;

const legacyLandingTokens = {
  navy: { hsl: '219 59% 22%', hex: '#172E59' },
  'logo-blue': {
    hsl: '200 100% 18%',
    hex: '#003C5A',
    tailwindPath: ['logoBlue'],
  },
  'bd-blue': {
    hsl: '212 100% 74%',
    hex: '#7CB8FF',
    tailwindPath: ['bdBlue'],
  },
  'marketing-orange': {
    hsl: '29 100% 75%',
    hex: '#FFBF82',
    tailwindPath: ['marketingOrange'],
  },
  'landing-purple-light': {
    hsl: '270 33% 96%',
    hex: '#F7F2FB',
    tailwindPath: ['landingPurpleLight'],
  },
} as const satisfies Record<string, ColorTokenDefinition>;

export const colorTokenGroups: readonly ColorTokenGroup[] = [
  { comment: 'Color System Tokens', tokens: colorSystemTokens },
  { comment: 'Auth page gradient tokens', tokens: authGradientTokens },
  {
    comment: 'Mentor pool hero gradient tokens',
    tokens: mentorHeroGradientTokens,
  },
  {
    comment: 'Legacy / Landing page specific colors',
    tokens: legacyLandingTokens,
  },
];

export const colorTokens = {
  ...colorSystemTokens,
  ...authGradientTokens,
  ...mentorHeroGradientTokens,
  ...legacyLandingTokens,
} as const;

export type ColorTokenKey = keyof typeof colorTokens;

export interface SemanticColorTokenDefinition<
  K extends string = ColorTokenKey,
> {
  readonly aliasOf: K;
  readonly tailwindPath: readonly [string, ...string[]];
}

export const semanticColorTokens = {
  background: {
    aliasOf: 'background-white',
    tailwindPath: ['background', 'DEFAULT'],
  },
  foreground: {
    aliasOf: 'text-primary',
    tailwindPath: ['foreground'],
  },
  card: {
    aliasOf: 'background-white',
    tailwindPath: ['card', 'DEFAULT'],
  },
  'card-foreground': {
    aliasOf: 'text-primary',
    tailwindPath: ['card', 'foreground'],
  },
  popover: {
    aliasOf: 'background-white',
    tailwindPath: ['popover', 'DEFAULT'],
  },
  'popover-foreground': {
    aliasOf: 'text-primary',
    tailwindPath: ['popover', 'foreground'],
  },
  primary: {
    aliasOf: 'brand-500',
    tailwindPath: ['primary', 'DEFAULT'],
  },
  'primary-foreground': {
    aliasOf: 'text-primary',
    tailwindPath: ['primary', 'foreground'],
  },
  secondary: {
    aliasOf: 'background-bottom',
    tailwindPath: ['secondary', 'DEFAULT'],
  },
  'secondary-foreground': {
    aliasOf: 'text-primary',
    tailwindPath: ['secondary', 'foreground'],
  },
  muted: {
    aliasOf: 'background-bottom',
    tailwindPath: ['muted', 'DEFAULT'],
  },
  'muted-foreground': {
    aliasOf: 'text-tertiary',
    tailwindPath: ['muted', 'foreground'],
  },
  accent: {
    aliasOf: 'background-bottom',
    tailwindPath: ['accent', 'DEFAULT'],
  },
  'accent-foreground': {
    aliasOf: 'text-primary',
    tailwindPath: ['accent', 'foreground'],
  },
  destructive: {
    aliasOf: 'status-error-default',
    tailwindPath: ['destructive', 'DEFAULT'],
  },
  'destructive-foreground': {
    aliasOf: 'text-white',
    tailwindPath: ['destructive', 'foreground'],
  },
  border: {
    aliasOf: 'background-border',
    tailwindPath: ['border'],
  },
  input: {
    aliasOf: 'background-border',
    tailwindPath: ['input'],
  },
  ring: {
    aliasOf: 'brand-500',
    tailwindPath: ['ring'],
  },
} as const satisfies Record<string, SemanticColorTokenDefinition>;

export type SemanticColorTokenKey = keyof typeof semanticColorTokens;

export interface BuildTailwindColorsOptions {
  readonly groups?: readonly ColorTokenGroup[];
  readonly semanticTokens?: Readonly<
    Record<string, SemanticColorTokenDefinition<string>>
  >;
}

function validateColorTokenEntry(
  key: string,
  definition: ColorTokenDefinition
): void {
  if (!TOKEN_KEY_PATTERN.test(key)) {
    throw new Error(
      `Invalid color token key "${key}": keys must use lowercase kebab-case alphanumeric characters.`
    );
  }
  if (!HSL_CHANNELS_PATTERN.test(definition.hsl.trim())) {
    throw new Error(
      `Invalid HSL channel value "${definition.hsl}" for color token "${key}": expected "<hue> <saturation>% <lightness>%".`
    );
  }
  if (!HEX_COLOR_PATTERN.test(definition.hex.trim())) {
    throw new Error(
      `Invalid HEX value "${definition.hex}" for color token "${key}": expected "#RRGGBB".`
    );
  }
}

export function resolveTailwindColorPath(
  key: string,
  definition?: Pick<ColorTokenDefinition, 'tailwindPath'>
): readonly string[] {
  if (definition?.tailwindPath) {
    if (
      definition.tailwindPath.length === 0 ||
      definition.tailwindPath.some((segment) => segment.trim().length === 0)
    ) {
      throw new Error(
        `Invalid tailwindPath for color token "${key}": path segments must be non-empty.`
      );
    }
    return definition.tailwindPath;
  }
  return key.split('-');
}

export function formatTailwindCssVarColor(cssVarName: string): string {
  const normalized = cssVarName.replace(/^--/, '').trim();
  if (!TOKEN_KEY_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid CSS custom property name "${cssVarName}": expected kebab-case alphanumeric name.`
    );
  }
  return `hsl(var(--${normalized}) / <alpha-value>)`;
}

function extractFieldMap(
  groups: readonly ColorTokenGroup[],
  field: 'hsl' | 'hex'
): Readonly<Record<string, string>> {
  const seen = new Set<string>();
  const record: Record<string, string> = {};

  for (const group of groups) {
    for (const [key, definition] of Object.entries(group.tokens)) {
      validateColorTokenEntry(key, definition);
      if (seen.has(key)) {
        throw new Error(`Duplicate color token key "${key}".`);
      }
      seen.add(key);
      record[key] =
        field === 'hex' ? definition.hex.toUpperCase() : definition.hsl;
    }
  }

  return Object.freeze(record);
}

export const rawColors: Readonly<Record<string, string>> = extractFieldMap(
  colorTokenGroups,
  'hsl'
);

export const hexColors: Readonly<Record<string, string>> = extractFieldMap(
  colorTokenGroups,
  'hex'
);

export function renderTokensCss(
  groups: readonly ColorTokenGroup[] = colorTokenGroups
): string {
  const seenKeys = new Set<string>();
  const cssLines: string[] = [
    '/* This file is automatically generated from src/design/tokens/color-values.ts. Do not edit directly. */',
    ':root {',
  ];

  for (const group of groups) {
    const trimmedComment = group.comment?.trim();
    if (trimmedComment) {
      if (trimmedComment.includes('*/')) {
        throw new Error(
          `Invalid color token group comment "${trimmedComment}": comment cannot contain "*/".`
        );
      }
      cssLines.push(`  /* ${trimmedComment} */`);
    }

    for (const [key, definition] of Object.entries(group.tokens)) {
      validateColorTokenEntry(key, definition);
      if (seenKeys.has(key)) {
        throw new Error(`Duplicate color token key "${key}".`);
      }
      seenKeys.add(key);
      cssLines.push(
        `  --color-${key}: ${definition.hsl.trim()}; /* ${definition.hex.trim().toUpperCase()} */`
      );
    }
  }

  cssLines.push('}');
  return `${cssLines.join('\n')}\n`;
}

function insertTailwindScaleEntry(
  root: TailwindColorScale,
  segments: readonly string[],
  value: string
): void {
  if (segments.length === 0 || segments.some((s) => s.trim().length === 0)) {
    throw new Error('Tailwind color path must contain non-empty segments.');
  }

  let cursor: TailwindColorScale = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const existing = cursor[segment];
    if (typeof existing === 'string') {
      throw new Error(
        `Tailwind color path collision at "${segments.slice(0, i + 1).join('.')}": cannot nest "${segments.join('.')}" under scalar value "${existing}".`
      );
    }
    if (existing === undefined) {
      const next: TailwindColorScale = {};
      cursor[segment] = next;
      cursor = next;
    } else {
      cursor = existing;
    }
  }

  const leafKey = segments[segments.length - 1];
  if (cursor[leafKey] !== undefined) {
    throw new Error(
      `Duplicate or colliding Tailwind color path "${segments.join('.')}".`
    );
  }
  cursor[leafKey] = value;
}

export function buildTailwindColors(
  options: BuildTailwindColorsOptions = {}
): TailwindColorScale {
  const groups = options.groups ?? colorTokenGroups;
  const semanticTokens = options.semanticTokens ?? semanticColorTokens;

  const colors: TailwindColorScale = {
    transparent: 'transparent',
    current: 'currentColor',
  };

  const registeredRawKeys = new Set<string>();

  for (const group of groups) {
    for (const [key, definition] of Object.entries(group.tokens)) {
      validateColorTokenEntry(key, definition);
      if (registeredRawKeys.has(key)) {
        throw new Error(`Duplicate color token key "${key}".`);
      }
      registeredRawKeys.add(key);

      const pathSegments = resolveTailwindColorPath(key, definition);
      insertTailwindScaleEntry(
        colors,
        pathSegments,
        formatTailwindCssVarColor(`color-${key}`)
      );
    }
  }

  for (const [semanticKey, semanticDef] of Object.entries(semanticTokens)) {
    if (!TOKEN_KEY_PATTERN.test(semanticKey)) {
      throw new Error(
        `Invalid semantic color token key "${semanticKey}": keys must use lowercase kebab-case alphanumeric characters.`
      );
    }
    if (!registeredRawKeys.has(semanticDef.aliasOf)) {
      throw new Error(
        `Semantic color token "${semanticKey}" aliases unknown raw color token "${semanticDef.aliasOf}".`
      );
    }

    const pathSegments = resolveTailwindColorPath(semanticKey, {
      tailwindPath: semanticDef.tailwindPath,
    });
    insertTailwindScaleEntry(
      colors,
      pathSegments,
      formatTailwindCssVarColor(semanticKey)
    );
  }

  return colors;
}

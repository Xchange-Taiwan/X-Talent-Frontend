const path = require('path');

// AST selector configurations to restrict arbitrary color/shadow/font size values in Tailwind classes
const tailwindArbitraryColorRule = {
  selector:
    "JSXAttribute[name.name='className'] Literal[value=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|outline|placeholder|decoration|accent|caret)-\\[(#|rgba?|hsla?)|(^|\\s|:)shadow-\\[[^\\]]*(#|rgba?|hsla?)/], JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|outline|placeholder|decoration|accent|caret)-\\[(#|rgba?|hsla?)|(^|\\s|:)shadow-\\[[^\\]]*(#|rgba?|hsla?)/], CallExpression[callee.name=/^(cn|clsx|cva)$/] Literal[value=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|outline|placeholder|decoration|accent|caret)-\\[(#|rgba?|hsla?)|(^|\\s|:)shadow-\\[[^\\]]*(#|rgba?|hsla?)/], CallExpression[callee.name=/^(cn|clsx|cva)$/] TemplateElement[value.raw=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|outline|placeholder|decoration|accent|caret)-\\[(#|rgba?|hsla?)|(^|\\s|:)shadow-\\[[^\\]]*(#|rgba?|hsla?)/]",
  message:
    'Do not use arbitrary hex, rgb, hsl colors, or arbitrary shadow colors (e.g. text-[#...], bg-[rgba(...)], shadow-[...rgba(...)]) in Tailwind classes. Please use standard theme colors or shadow tokens from tailwind.config.js.',
};

const tailwindDefaultScaleRule = {
  selector:
    "JSXAttribute[name.name='className'] Literal[value=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|shadow|outline|placeholder|decoration|accent|caret)-(slate|zinc|neutral|stone|gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+/], JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|shadow|outline|placeholder|decoration|accent|caret)-(slate|zinc|neutral|stone|gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+/], CallExpression[callee.name=/^(cn|clsx|cva)$/] Literal[value=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|shadow|outline|placeholder|decoration|accent|caret)-(slate|zinc|neutral|stone|gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+/], CallExpression[callee.name=/^(cn|clsx|cva)$/] TemplateElement[value.raw=/(^|\\s|:)(bg|text|border(-[trblxy])?|ring(-offset)?|fill|stroke|from|via|to|divide|shadow|outline|placeholder|decoration|accent|caret)-(slate|zinc|neutral|stone|gray|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d+/]",
  message:
    'Do not use default Tailwind colors with numeric scales (e.g., neutral-600, blue-600, red-500) because they are not defined in the custom theme palette. Use custom theme tokens from src/design/tokens/color.ts instead (e.g., text-text-secondary, text-status-error-default, bg-brand-500).',
};

const tailwindArbitraryFontSizeRule = {
  selector:
    "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)text-\\[(\\d*\\.)?\\d+(px|rem|em)\\]/], JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\\s)text-\\[(\\d*\\.)?\\d+(px|rem|em)\\]/], CallExpression[callee.name=/^(cn|clsx|cva)$/] Literal[value=/(^|\\s)text-\\[(\\d*\\.)?\\d+(px|rem|em)\\]/], CallExpression[callee.name=/^(cn|clsx|cva)$/] TemplateElement[value.raw=/(^|\\s)text-\\[(\\d*\\.)?\\d+(px|rem|em)\\]/]",
  message:
    'Do not use arbitrary font sizes (e.g. text-[12px], text-[1.5rem]) in Tailwind classes. Please use standard font size classes like text-sm, text-base, text-14, text-18, etc.',
};

module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:storybook/recommended',
    'plugin:tailwindcss/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'simple-import-sort', 'jsx-a11y'],
  settings: {
    tailwindcss: {
      callees: ['cn', 'cva', 'clsx'],
      config: path.resolve(__dirname, 'src/styles/global.css'),
    },
  },
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'tailwindcss/no-custom-classname': [
      'error',
      {
        whitelist: ['destructive'],
      },
    ],
    // Guard against arbitrary Tailwind colors, default Tailwind scales, and arbitrary font sizes
    'no-restricted-syntax': [
      'error',
      tailwindArbitraryColorRule,
      tailwindDefaultScaleRule,
      tailwindArbitraryFontSizeRule,
    ],
  },
  overrides: [
    {
      // Allow arbitrary Tailwind colors (like hardcoded brand colors and Next.js OG/Twitter Image routes that cannot consume Tailwind classes), but keep the default Tailwind scales and arbitrary font sizes rules
      files: [
        'src/components/icon/color/*.tsx',
        'src/app/**/opengraph-image.tsx',
        'src/app/**/twitter-image.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          tailwindDefaultScaleRule,
          tailwindArbitraryFontSizeRule,
        ],
      },
    },
    {
      files: ['src/lib/profile/saveProfile.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message:
                  'saveProfile.ts is a deep module and should not import react.',
              },
              {
                name: 'next/navigation',
                message:
                  'saveProfile.ts is a deep module and should not import next/navigation.',
              },
              {
                name: 'next-auth/react',
                message:
                  'saveProfile.ts is a deep module and should not import next-auth/react.',
              },
            ],
            patterns: [
              {
                group: ['@/hooks/**'],
                message:
                  'saveProfile.ts is a deep module and should not import from the hooks layer.',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'build/',
    'dist/',
    'storybook-static/',
    '*.config.js',
    '*.config.ts',
    '.eslintrc.js',
  ],
};

import type { StorybookConfig } from '@storybook/nextjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  env: (existingEnv) => ({
    ...existingEnv,
    NEXT_PUBLIC_ENABLE_FAVORITES:
      existingEnv?.NEXT_PUBLIC_ENABLE_FAVORITES?.trim() ||
      process.env.NEXT_PUBLIC_ENABLE_FAVORITES?.trim() ||
      'true',
    NEXT_PUBLIC_ENABLE_FEEDBACK:
      existingEnv?.NEXT_PUBLIC_ENABLE_FEEDBACK?.trim() ||
      process.env.NEXT_PUBLIC_ENABLE_FEEDBACK?.trim() ||
      'true',
  }),
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'storybook/internal/theming': require.resolve('storybook/theming'),
      };
    }
    return config;
  },
};
export default config;

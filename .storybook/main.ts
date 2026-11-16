import type { StorybookConfig } from '@storybook/nextjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.NEXT_PUBLIC_ENABLE_FAVORITES ??= 'true';
process.env.NEXT_PUBLIC_ENABLE_FEEDBACK ??= 'true';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  env: (existingEnv) => ({
    ...existingEnv,
    NEXT_PUBLIC_ENABLE_FAVORITES:
      process.env.NEXT_PUBLIC_ENABLE_FAVORITES ?? 'true',
    NEXT_PUBLIC_ENABLE_FEEDBACK:
      process.env.NEXT_PUBLIC_ENABLE_FEEDBACK ?? 'true',
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

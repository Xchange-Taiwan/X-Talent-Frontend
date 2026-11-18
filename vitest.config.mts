import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';
import { defineConfig } from 'vitest/config';

const rootDir = import.meta.dirname;
const sharedAlias = {
  '@': path.resolve(rootDir, './src'),
};
const sharedEnv = {
  TZ: 'UTC',
  // Pinned so URL-building tests get a deterministic relative-path
  // BASE_URL regardless of what's leaked into process.env by whatever
  // invoked vitest (e.g. a process that loaded .env.development.local).
  NEXT_PUBLIC_API_URL: '',
};

// Pure-TypeScript tests under src/lib and src/services that intentionally
// exercise browser globals (window, document, localStorage, StorageEvent).
const DOM_DEPENDENT_LIB_TESTS = [
  'src/lib/analytics.test.ts',
  'src/lib/analyticsClarity919.test.ts',
  'src/lib/apiClient.test.ts',
  'src/lib/storage.test.ts',
  'src/lib/auth/authFlowStorage.test.ts',
  'src/lib/auth/sessionHint.test.ts',
  'src/lib/auth/sessionLifecycle.test.ts',
  'src/lib/cache/userProfileDtoCache.test.ts',
  'src/lib/favorites/pendingFavoriteStorage.test.ts',
  'src/lib/profile/saveProfile.test.ts',
  'src/lib/profile/searchSchools.test.ts',
  'src/lib/reservation/pendingFeedbackGuard.test.ts',
  'src/lib/url/isSafeUrl.test.ts',
  'src/services/auth/authClient.test.ts',
  'src/services/favorites/favoriteMentors.contract.test.ts',
  'src/services/reservations/reservationMutations.test.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sharedAlias,
  },
  test: {
    globals: true,
    env: sharedEnv,
    // Use all available CPU cores on 4-vCPU GitHub Actions public runners unless
    // explicitly overridden via VITEST_MAX_WORKERS.
    maxWorkers: process.env.VITEST_MAX_WORKERS
      ? Number(process.env.VITEST_MAX_WORKERS)
      : process.env.CI
        ? Math.max(2, os.availableParallelism())
        : undefined,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-node',
          environment: 'node',
          include: [
            'scripts/**/*.{test,spec}.mjs',
            'src/*.{test,spec}.ts',
            'src/{actions,constant,constants,data,design,lib,schemas,services,utils}/**/*.{test,spec}.ts',
          ],
          exclude: ['node_modules/**', ...DOM_DEPENDENT_LIB_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui-dom',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          server: {
            deps: {
              inline: [/@storybook\/nextjs/],
            },
          },
          include: [
            'src/{app,components,hooks,stores,docs,test}/**/*.{test,spec}.{ts,tsx}',
            'src/{actions,constant,constants,data,design,lib,schemas,services,utils}/**/*.{test,spec}.tsx',
            'src/*.{test,spec}.tsx',
            '.storybook/**/*.{test,spec}.{ts,tsx}',
            ...DOM_DEPENDENT_LIB_TESTS,
          ],
          exclude: ['node_modules/**'],
        },
      },
    ],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: process.env.CI
        ? ['text', 'json', 'lcovonly']
        : ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/**/__mocks__/**',
      ],
      // Ratcheted 2026-11-17 against ~91.6% statements / ~85.7% branches /
      // ~89.6% functions / ~92.9% lines baseline (~2-3% noise buffer).
      thresholds: {
        perFile: false,
        statements: 89,
        branches: 83,
        functions: 87,
        lines: 90,
      },
    },
  },
});

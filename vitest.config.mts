import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

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
  'src/lib/chunkErrorRecovery.test.ts',
  'src/lib/monitoring.test.ts',
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

const DOM_DEPENDENT_LIB_SET = new Set(DOM_DEPENDENT_LIB_TESTS);
const PURE_NODE_SRC_ROOTS = [
  'actions',
  'constant',
  'constants',
  'data',
  'design',
  'lib',
  'schemas',
  'services',
  'utils',
];

export function collectPureNodeSrcTests(baseDir = rootDir): string[] {
  const results: string[] = [];
  const srcRoot = path.join(baseDir, 'src');
  if (!fs.existsSync(srcRoot)) return results;

  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (entry.isFile() && /\.(?:test|spec)\.ts$/.test(entry.name)) {
      const rel = `src/${entry.name}`;
      if (!DOM_DEPENDENT_LIB_SET.has(rel)) results.push(rel);
    }
  }

  for (const sub of PURE_NODE_SRC_ROOTS) {
    const dirAbs = path.join(srcRoot, sub);
    if (!fs.existsSync(dirAbs)) continue;
    for (const relSub of fs.readdirSync(dirAbs, { recursive: true })) {
      const normalized = `src/${sub}/${String(relSub).replace(/\\/g, '/')}`;
      if (
        /\.(?:test|spec)\.ts$/.test(normalized) &&
        !DOM_DEPENDENT_LIB_SET.has(normalized)
      ) {
        results.push(normalized);
      }
    }
  }

  return results.sort();
}

const pureNodeSrcTests = collectPureNodeSrcTests();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sharedAlias,
  },
  test: {
    globals: true,
    env: sharedEnv,
    execArgv: ['--max-old-space-size=4096'],
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
          include: ['scripts/**/*.{test,spec}.mjs', ...pureNodeSrcTests],
          exclude: ['node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui-dom',
          environment: 'jsdom',
          testTimeout: 15000,
          setupFiles: ['./src/test/setup.ts'],
          server: {
            deps: {
              inline: [/@storybook\/nextjs/],
            },
          },
          // Catch-all across src/** and .storybook/** excluding the exact
          // pureNodeSrcTests set so new directories are never silently dropped.
          include: [
            'src/**/*.{test,spec}.{ts,tsx,mjs}',
            '.storybook/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: ['node_modules/**', ...pureNodeSrcTests],
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

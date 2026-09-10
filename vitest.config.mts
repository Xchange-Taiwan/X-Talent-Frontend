import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      TZ: 'UTC',
      // Pinned so URL-building tests get a deterministic relative-path
      // BASE_URL regardless of what's leaked into process.env by whatever
      // invoked vitest (e.g. a process that loaded .env.development.local).
      NEXT_PUBLIC_API_URL: '',
    },
    setupFiles: ['./src/test/setup.ts'],
    // maxWorkers: 1 alone already serializes test files in CI (fileParallelism's
    // effect); the previous poolOptions.forks.singleFork block was a no-op since
    // singleFork's default is already false, so it added nothing and is dropped.
    maxWorkers: process.env.CI ? 1 : undefined,
    server: {
      deps: {
        inline: [/@storybook\/nextjs/],
      },
    },
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.{test,spec}.mjs',
      '.storybook/**/*.{test,spec}.{ts,tsx}',
    ],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      // `html` (and istanbul's `lcov`, which internally composes lcovonly +
      // html - see istanbul-reports/lib/lcov) are the most expensive
      // reporters to generate, rendering a per-file interactive page, and
      // nothing in CI consumes that output - skip both there so the coverage
      // floor gate doesn't add avoidable overhead. Locally, keep the full
      // set since `pnpm test:coverage` is how you browse uncovered lines.
      reporter: process.env.CI
        ? ['text', 'json', 'lcovonly']
        : ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/**/__mocks__/**',
      ],
      // Coverage floor gate (see CONTRIBUTING.md "Coverage floor policy").
      //
      // Baseline: measured 2026-09-10 on `develop` after #675-#683 landed, via
      // `pnpm test:coverage`:
      //   statements 85.28%, branches 78.79%, functions 78.45%, lines 86.64%
      //
      // Each floor below is set a couple of points under that measured number
      // so normal run-to-run noise doesn't cause spurious CI failures, while
      // still catching a real regression. This floor only ratchets up as
      // coverage improves; lowering any number here requires a stated reason
      // (see CONTRIBUTING.md).
      thresholds: {
        // Explicit: this is one global floor for the whole repo, not a
        // per-file requirement (Vitest defaults to global when omitted, but
        // that default is easy to invert by mistake - see CONTRIBUTING.md).
        perFile: false,
        statements: 84,
        branches: 77,
        functions: 77,
        lines: 85,
      },
    },
  },
});

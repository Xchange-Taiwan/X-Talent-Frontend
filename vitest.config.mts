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
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/**/__mocks__/**',
      ],
    },
  },
});

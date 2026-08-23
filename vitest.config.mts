import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    maxWorkers: process.env.CI ? 1 : undefined,
    poolOptions: {
      forks: {
        singleFork: process.env.CI ? false : undefined,
      },
    },
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
  },
});

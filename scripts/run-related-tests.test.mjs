// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { selectVitestRelatedTargets } from './run-related-tests.mjs';

describe('scripts/run-related-tests', () => {
  it('selects source and script code files while filtering out markdown, workflows, and deleted/irrelevant assets', () => {
    const targets = selectVitestRelatedTargets([
      'README.md',
      '.github/workflows/test.yml',
      'src/lib/env.ts',
      'src/components/ErrorBoundary.tsx',
      'scripts/check-ci-paths.mjs',
      'public/logo.svg',
    ]);
    expect(targets).toEqual([
      'src/lib/env.ts',
      'src/components/ErrorBoundary.tsx',
      'scripts/check-ci-paths.mjs',
    ]);
  });

  it('signals full-suite run when vitest or tsconfig root test config changes', () => {
    expect(
      selectVitestRelatedTargets(['vitest.config.mts'], {
        detectGlobalConfig: true,
      })
    ).toEqual({ runAll: true, targets: [] });
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { classifyChangedCiPaths } from './check-ci-paths.mjs';

describe('scripts/check-ci-paths', () => {
  it('treats pure markdown and docs changes as docs-only so heavy build and full test jobs fast-pass', () => {
    const res = classifyChangedCiPaths([
      'README.md',
      'docs/architecture/overview.md',
      'scripts/README.md',
    ]);
    expect(res).toEqual({
      docsOnly: true,
      needsBuild: false,
      needsTests: false,
      needsStorybookBuild: false,
    });
  });

  it('flags needsBuild and needsTests when application source or build configs change', () => {
    const res = classifyChangedCiPaths(['src/components/ErrorBoundary.tsx']);
    expect(res.docsOnly).toBe(false);
    expect(res.needsBuild).toBe(true);
    expect(res.needsTests).toBe(true);
    expect(res.needsStorybookBuild).toBe(false);
  });

  it('flags needsStorybookBuild without needsBuild when only .stories.tsx or .storybook files change', () => {
    const res = classifyChangedCiPaths([
      'src/components/ErrorBoundary.stories.tsx',
      '.storybook/preview.ts',
    ]);
    expect(res.docsOnly).toBe(false);
    expect(res.needsBuild).toBe(false);
    expect(res.needsTests).toBe(true);
    expect(res.needsStorybookBuild).toBe(true);
  });

  it('flags needsTests without needsBuild when only unit test files change', () => {
    const res = classifyChangedCiPaths(['src/lib/env.test.ts']);
    expect(res.docsOnly).toBe(false);
    expect(res.needsBuild).toBe(false);
    expect(res.needsTests).toBe(true);
    expect(res.needsStorybookBuild).toBe(false);
  });
});

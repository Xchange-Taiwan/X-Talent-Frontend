// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  classifyChangedCiPaths,
  validateBaseBranchRef,
} from './check-ci-paths.mjs';

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

  it('fails safe to full checks on empty input, normalizes Windows/relative paths, and classifies config/public/e2e files', () => {
    expect(classifyChangedCiPaths([])).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: true,
    });
    expect(classifyChangedCiPaths(['   '])).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: true,
    });

    const winNormalized = classifyChangedCiPaths(['.\\src\\lib\\env.ts']);
    expect(winNormalized).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: false,
    });

    expect(classifyChangedCiPaths(['next.config.js'])).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: false,
    });
    expect(classifyChangedCiPaths(['tsconfig.e2e.json'])).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: true,
      needsStorybookBuild: false,
    });
    expect(classifyChangedCiPaths(['public/logo.svg'])).toEqual({
      docsOnly: false,
      needsBuild: true,
      needsTests: false,
      needsStorybookBuild: false,
    });
    expect(classifyChangedCiPaths(['e2e/tests/public/signin.spec.ts'])).toEqual(
      {
        docsOnly: false,
        needsBuild: false,
        needsTests: false,
        needsStorybookBuild: false,
      }
    );
  });

  it('rejects flag-shaped or invalid base branch refs', () => {
    expect(validateBaseBranchRef('develop')).toBe('develop');
    expect(validateBaseBranchRef('release/1.2')).toBe('release/1.2');
    expect(() => validateBaseBranchRef('--upload-pack=evil')).toThrow(
      /Invalid base branch ref/
    );
    expect(() => validateBaseBranchRef('bad ref with spaces')).toThrow(
      /Invalid base branch ref/
    );
  });
});

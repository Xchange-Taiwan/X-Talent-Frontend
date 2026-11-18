// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { collectPureNodeSrcTests } from '../vitest.config.mts';

describe('vitest dual-project partition', () => {
  it('partitions 100% of tracked src, scripts, and .storybook test files across unit-node and ui-dom with zero drops or duplicates', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((f) =>
        /^(?:src|scripts|\.storybook)\/.*\.(?:test|spec)\.(?:ts|tsx|mjs)$/.test(
          f
        )
      );

    expect(tracked.length).toBeGreaterThan(280);

    const pureNodeSet = new Set(collectPureNodeSrcTests());
    let unitNodeCount = 0;
    let uiDomCount = 0;

    for (const file of tracked) {
      const inUnitNode =
        /^scripts\/.*\.(?:test|spec)\.mjs$/.test(file) || pureNodeSet.has(file);
      const inUiDom =
        /^(?:src|\.storybook)\/.*\.(?:test|spec)\.(?:ts|tsx|mjs)$/.test(file) &&
        !pureNodeSet.has(file);

      expect(
        Number(inUnitNode) + Number(inUiDom),
        `Expected ${file} to match exactly 1 Vitest project`
      ).toBe(1);

      if (inUnitNode) unitNodeCount += 1;
      if (inUiDom) uiDomCount += 1;
    }

    expect(unitNodeCount).toBeGreaterThan(80);
    expect(uiDomCount).toBeGreaterThan(150);
  });
});

// @vitest-environment node
import { execFileSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  classifyDiffFilePriority,
  getDiff,
  getWorkingTreeDiff,
  MAX_DIFF_CHARS,
  prioritizeUnifiedDiff,
} from './diff.mjs';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

afterEach(() => {
  vi.mocked(execFileSync).mockReset();
});

describe('getDiff', () => {
  it('returns the raw diff untruncated when under the size limit', () => {
    vi.mocked(execFileSync).mockReturnValue('diff --git a/x b/x\n+line\n');

    const result = getDiff('origin/develop', 'abc123headsha');

    expect(result).toEqual({
      diff: 'diff --git a/x b/x\n+line\n',
      truncated: false,
    });
  });

  it('truncates and appends a marker when the diff exceeds MAX_DIFF_CHARS (120000 chars)', () => {
    const raw = 'x'.repeat(MAX_DIFF_CHARS + 1);
    vi.mocked(execFileSync).mockReturnValue(raw);

    const result = getDiff('origin/develop', 'abc123headsha');

    expect(MAX_DIFF_CHARS).toBe(120000);
    expect(result.truncated).toBe(true);
    expect(result.diff.startsWith('x'.repeat(MAX_DIFF_CHARS))).toBe(true);
    expect(result.diff).toContain(
      `... (diff truncated, ${MAX_DIFF_CHARS + 1} chars total)`
    );
    expect(result.diff.slice(0, MAX_DIFF_CHARS)).toBe(
      raw.slice(0, MAX_DIFF_CHARS)
    );
  });

  it('does not truncate a diff exactly at the size limit', () => {
    const raw = 'x'.repeat(MAX_DIFF_CHARS);
    vi.mocked(execFileSync).mockReturnValue(raw);

    const result = getDiff('origin/develop', 'abc123headsha');

    expect(result).toEqual({ diff: raw, truncated: false });
  });

  it('reorders multi-file diffs so core src/** production files come ahead of stories, unit tests, and e2e specs', () => {
    expect(
      classifyDiffFilePriority('src/components/profile/MentorSummaryBar.tsx')
    ).toBe(0);
    expect(classifyDiffFilePriority('src/lib/mentor/mentorStats.ts')).toBe(0);
    expect(classifyDiffFilePriority('scripts/ai-review/lib/diff.mjs')).toBe(1);
    expect(
      classifyDiffFilePriority('src/app/profile/[pageUserId]/ui.stories.tsx')
    ).toBe(2);
    expect(
      classifyDiffFilePriority('src/app/profile/[pageUserId]/ui.test.tsx')
    ).toBe(2);
    expect(
      classifyDiffFilePriority('e2e/tests/profile/mentor-feedback.spec.ts')
    ).toBe(3);

    const rawMulti = [
      'diff --git a/e2e/tests/profile/mentor-feedback.spec.ts b/e2e/tests/profile/mentor-feedback.spec.ts\n+e2e line\n',
      'diff --git a/src/app/profile/[pageUserId]/ui.stories.tsx b/src/app/profile/[pageUserId]/ui.stories.tsx\n+story line\n',
      'diff --git a/src/app/profile/[pageUserId]/ui.test.tsx b/src/app/profile/[pageUserId]/ui.test.tsx\n+unit test line\n',
      'diff --git a/src/components/profile/feedback/MentorSummaryBar.tsx b/src/components/profile/feedback/MentorSummaryBar.tsx\n+prod component\n',
      'diff --git a/src/types/feedback.ts b/src/types/feedback.ts\n+prod type\n',
    ].join('');

    const reordered = prioritizeUnifiedDiff(rawMulti);
    const idxComp = reordered.indexOf('MentorSummaryBar.tsx');
    const idxType = reordered.indexOf('src/types/feedback.ts');
    const idxStory = reordered.indexOf('ui.stories.tsx');
    const idxUnit = reordered.indexOf('ui.test.tsx');
    const idxE2e = reordered.indexOf('mentor-feedback.spec.ts');

    expect(idxComp).toBeGreaterThanOrEqual(0);
    expect(idxComp).toBeLessThan(idxType);
    expect(idxType).toBeLessThan(idxStory);
    expect(idxStory).toBeLessThan(idxUnit);
    expect(idxUnit).toBeLessThan(idxE2e);
  });

  it('supports working-tree diffs for run-local.mjs with the same exclusions and priority ordering', () => {
    vi.mocked(execFileSync).mockReturnValue(
      'diff --git a/e2e/a.spec.ts b/e2e/a.spec.ts\n+1\ndiff --git a/src/a.ts b/src/a.ts\n+2\n'
    );

    const res = getWorkingTreeDiff('origin/develop');
    expect(res.truncated).toBe(false);
    expect(res.diff.indexOf('src/a.ts')).toBeLessThan(
      res.diff.indexOf('e2e/a.spec.ts')
    );
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['diff', 'origin/develop', '--', '.']),
      expect.objectContaining({ encoding: 'utf-8' })
    );
  });

  it('includes untracked working-tree text files in getWorkingTreeDiff while excluding .env*, .agents/tmp*, lockfiles, and binaries', () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (Array.isArray(args) && args[0] === 'diff') {
        return 'diff --git a/src/components/Providers.tsx b/src/components/Providers.tsx\n+<AnalyticsUserSync />\n';
      }
      if (Array.isArray(args) && args[0] === 'ls-files') {
        return [
          'e2e/tests/public/ga4-user-identity.spec.ts',
          'src/components/AnalyticsUserSync.tsx',
          '.env.e2e.local',
          '.agents/tmp/ticket-spec.md',
          'public/banner.png',
          'src/binary.bin',
        ].join('\n');
      }
      return '';
    });

    const virtualFiles = new Map([
      [
        'src/components/AnalyticsUserSync.tsx',
        Buffer.from(
          'export default function AnalyticsUserSync() { return null; }\n'
        ),
      ],
      [
        'e2e/tests/public/ga4-user-identity.spec.ts',
        Buffer.from("test('ga4 identity', async () => {});\n"),
      ],
      ['src/binary.bin', Buffer.from([0x89, 0x50, 0x00, 0x47])],
    ]);

    const res = getWorkingTreeDiff('origin/develop', {
      existsSync: (p) => virtualFiles.has(p),
      statSync: () => ({ isFile: () => true }),
      readFileSync: (p) => virtualFiles.get(p),
    });

    expect(res.truncated).toBe(false);
    expect(res.diff).toContain(
      'diff --git a/src/components/AnalyticsUserSync.tsx b/src/components/AnalyticsUserSync.tsx\nnew file mode 100644'
    );
    expect(res.diff).toContain(
      'diff --git a/e2e/tests/public/ga4-user-identity.spec.ts b/e2e/tests/public/ga4-user-identity.spec.ts\nnew file mode 100644'
    );
    // Core src/** untracked file must be prioritized ahead of e2e/**
    expect(
      res.diff.indexOf('src/components/AnalyticsUserSync.tsx')
    ).toBeLessThan(
      res.diff.indexOf('e2e/tests/public/ga4-user-identity.spec.ts')
    );
    expect(res.diff).not.toContain('.env.e2e.local');
    expect(res.diff).not.toContain('.agents/tmp/ticket-spec.md');
    expect(res.diff).not.toContain('public/banner.png');
    expect(res.diff).not.toContain('src/binary.bin');
  });

  it('invokes git diff between the given base ref and head ref with the lockfile/asset exclude pathspecs', () => {
    vi.mocked(execFileSync).mockReturnValue('');

    getDiff('origin/develop', 'abc123headsha');

    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      [
        'diff',
        'origin/develop...abc123headsha',
        '--',
        '.',
        ':(exclude)pnpm-lock.yaml',
        ':(exclude)package-lock.json',
        ':(exclude)yarn.lock',
        ':(exclude)*.snap',
        ':(exclude)public/**',
      ],
      expect.objectContaining({ encoding: 'utf-8' })
    );
  });
});

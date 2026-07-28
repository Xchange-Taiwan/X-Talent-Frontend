// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { getDiff } from './diff.mjs';

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

  it('truncates and appends a marker when the diff exceeds 60000 chars', () => {
    const raw = 'x'.repeat(60001);
    vi.mocked(execFileSync).mockReturnValue(raw);

    const result = getDiff('origin/develop', 'abc123headsha');

    expect(result.truncated).toBe(true);
    expect(result.diff.startsWith('x'.repeat(60000))).toBe(true);
    expect(result.diff).toContain('... (diff truncated, 60001 chars total)');
    expect(result.diff.slice(0, 60000)).toBe(raw.slice(0, 60000));
  });

  it('does not truncate a diff exactly at the size limit', () => {
    const raw = 'x'.repeat(60000);
    vi.mocked(execFileSync).mockReturnValue(raw);

    const result = getDiff('origin/develop', 'abc123headsha');

    expect(result).toEqual({ diff: raw, truncated: false });
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

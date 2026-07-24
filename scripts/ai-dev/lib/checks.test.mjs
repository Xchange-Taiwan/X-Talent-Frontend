// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));
vi.mock('./proc.mjs', () => ({ runProcess: vi.fn() }));
vi.mock('./git.mjs', () => ({
  stageFiles: vi.fn(),
  stagedFilesExcludingDeleted: vi.fn(),
}));

const { readFileSync } = await import('node:fs');
const { runProcess } = await import('./proc.mjs');
const { stageFiles, stagedFilesExcludingDeleted } = await import('./git.mjs');
const {
  ChecksError,
  verifyRequiredScripts,
  autoFixAndLintStaged,
  captureTypeCheckBaseline,
  diffTypeCheckErrors,
} = await import('./checks.mjs');

beforeEach(() => {
  vi.clearAllMocks();
});

function tscOutput(...lines) {
  return lines.join('\n');
}

describe('verifyRequiredScripts', () => {
  it('does not throw when package.json has every required script', () => {
    readFileSync.mockReturnValue(
      JSON.stringify({
        scripts: {
          lint: 'x',
          'lint:fix': 'x',
          'type-check': 'x',
          build: 'x',
          test: 'x',
        },
      })
    );
    expect(() => verifyRequiredScripts()).not.toThrow();
  });

  it('throws ChecksError naming the missing script(s)', () => {
    readFileSync.mockReturnValue(
      JSON.stringify({
        scripts: { lint: 'x', 'lint:fix': 'x', 'type-check': 'x' },
      })
    );
    expect(() => verifyRequiredScripts()).toThrow(ChecksError);
    expect(() => verifyRequiredScripts()).toThrow(/build.*test|test.*build/);
  });

  it('throws when package.json has no scripts field at all', () => {
    readFileSync.mockReturnValue(JSON.stringify({}));
    expect(() => verifyRequiredScripts()).toThrow(ChecksError);
  });
});

describe('autoFixAndLintStaged', () => {
  it('skips entirely when there are no lintable staged files', async () => {
    stagedFilesExcludingDeleted.mockReturnValue(['README.md', 'package.json']);
    const result = await autoFixAndLintStaged();
    expect(result).toEqual({ skipped: true, ok: true, output: '' });
    expect(runProcess).not.toHaveBeenCalled();
  });

  it('filters out non-lintable extensions before deciding whether to run', async () => {
    stagedFilesExcludingDeleted.mockReturnValue([
      'src/a.ts',
      'README.md',
      'src/b.tsx',
    ]);
    runProcess.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await autoFixAndLintStaged();
    const [, args] = runProcess.mock.calls[0];
    expect(args).toContain('src/a.ts');
    expect(args).toContain('src/b.tsx');
    expect(args).not.toContain('README.md');
  });

  it('runs eslint --fix scoped to the staged files with an argument-injection-safe --', async () => {
    stagedFilesExcludingDeleted.mockReturnValue(['src/a.ts']);
    runProcess.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await autoFixAndLintStaged();
    expect(runProcess).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'eslint', '--fix', '--', 'src/a.ts'],
      expect.anything()
    );
  });

  it('re-stages exactly the touched files after --fix, not the whole working tree', async () => {
    stagedFilesExcludingDeleted.mockReturnValue(['src/a.ts', 'src/b.tsx']);
    runProcess.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await autoFixAndLintStaged();
    expect(stageFiles).toHaveBeenCalledWith(['src/a.ts', 'src/b.tsx']);
  });

  it('reports ok:false and combined output when eslint exits non-zero', async () => {
    stagedFilesExcludingDeleted.mockReturnValue(['src/a.ts']);
    runProcess.mockResolvedValue({
      code: 1,
      stdout: 'src/a.ts\n  1:1  error  no-unused-vars',
      stderr: '',
    });
    const result = await autoFixAndLintStaged();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('no-unused-vars');
  });
});

describe('captureTypeCheckBaseline', () => {
  it('parses tsc error lines into a map of position-independent keys to occurrence counts', async () => {
    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(
        "src/foo.ts(42,10): error TS2345: Argument of type 'string' is not assignable."
      ),
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();
    expect(baseline.size).toBe(1);
    const [key] = [...baseline.keys()];
    expect(key).not.toMatch(/\(\d+,\d+\)/);
    expect(key).toContain('src/foo.ts');
    expect(key).toContain('TS2345');
    expect(baseline.get(key)).toBe(1);
  });

  it('ignores non-error output (banners, summary lines)', async () => {
    runProcess.mockResolvedValue({
      code: 0,
      stdout: 'tsc version 5.3.3\nFound 0 errors.',
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();
    expect(baseline.size).toBe(0);
  });

  it('throws ChecksError when the baseline run times out', async () => {
    runProcess.mockResolvedValue({
      code: -1,
      stdout: '',
      stderr: '',
      timedOut: true,
    });
    await expect(captureTypeCheckBaseline()).rejects.toThrow(ChecksError);
  });

  it('treats a multi-line error (primary line + indented continuation) as a single entry, not several', async () => {
    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(
        "src/foo.ts(42,10): error TS2322: Type 'Foo' is not assignable to type 'Bar'.",
        "  Property 'baz' is missing in type 'Foo' but required in type 'Bar'.",
        '',
        "src/other.ts(5,1): error TS2304: Cannot find name 'x'."
      ),
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();
    expect(baseline.size).toBe(2);
  });
});

describe('diffTypeCheckErrors', () => {
  it('reports ok:true with no new errors when current output exactly matches baseline', async () => {
    const line =
      "src/foo.ts(42,10): error TS2345: Argument of type 'string' is not assignable.";
    runProcess.mockResolvedValue({
      code: 1,
      stdout: line,
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    runProcess.mockResolvedValue({
      code: 1,
      stdout: line,
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(true);
    expect(result.newErrors).toEqual([]);
  });

  it('does not flag a pre-existing error as new when it shifts to a different line number', async () => {
    runProcess.mockResolvedValue({
      code: 1,
      stdout:
        "src/foo.ts(42,10): error TS2345: Argument of type 'string' is not assignable.",
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    // same file/code/message, shifted down one line — as if the agent added an import above it
    runProcess.mockResolvedValue({
      code: 1,
      stdout:
        "src/foo.ts(43,10): error TS2345: Argument of type 'string' is not assignable.",
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(true);
    expect(result.newErrors).toEqual([]);
  });

  it('detects a genuinely new error not present in the baseline', async () => {
    runProcess.mockResolvedValue({
      code: 0,
      stdout: 'Found 0 errors.',
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    runProcess.mockResolvedValue({
      code: 1,
      stdout:
        "src/bar.ts(10,3): error TS7006: Parameter 'x' implicitly has an 'any' type.",
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(false);
    expect(result.newErrors).toHaveLength(1);
    expect(result.newErrors[0]).toContain('TS7006');
  });

  it('includes indented continuation lines in newErrors, not just the terse summary line', async () => {
    const baseline = new Map();
    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(
        "src/foo.ts(42,10): error TS2322: Type 'Foo' is not assignable to type 'Bar'.",
        "  Property 'baz' is missing in type 'Foo' but required in type 'Bar'."
      ),
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.newErrors).toHaveLength(1);
    expect(result.newErrors[0]).toContain("Property 'baz' is missing");
  });

  it('detects a second occurrence of an identically-worded error as new (count-based, not a plain Set)', async () => {
    const line =
      "src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.";
    runProcess.mockResolvedValue({
      code: 1,
      stdout: line,
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    // same exact wording, but now appears twice — e.g. the agent copy-pasted
    // the same buggy pattern into a second call site in the same file
    const otherLine =
      "src/foo.ts(88,5): error TS2322: Type 'string' is not assignable to type 'number'.";
    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(line, otherLine),
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(false);
    expect(result.newErrors).toHaveLength(1);
    expect(result.newErrors[0]).toContain('(88,5)');
  });

  it('does not flag anything new when the current run has the same count as the baseline', async () => {
    const line =
      "src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.";
    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(line, line),
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    runProcess.mockResolvedValue({
      code: 1,
      stdout: tscOutput(line, line),
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(true);
    expect(result.newErrors).toEqual([]);
  });

  it('does not require exit code 0 when every current error is already in the baseline (pre-existing tech debt)', async () => {
    const line = 'src/legacy.ts(5,1): error TS2304: Cannot find name.';
    runProcess.mockResolvedValue({
      code: 1,
      stdout: line,
      stderr: '',
      timedOut: false,
    });
    const baseline = await captureTypeCheckBaseline();

    runProcess.mockResolvedValue({
      code: 1,
      stdout: line,
      stderr: '',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(true);
  });

  it('reports ok:false when tsc exits non-zero with no parseable errors (a real crash, not explained by TS errors)', async () => {
    const baseline = new Map();
    runProcess.mockResolvedValue({
      code: 2,
      stdout: '',
      stderr: 'FATAL ERROR: out of memory',
      timedOut: false,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(false);
  });

  it('reports ok:false with an explanatory message when the run times out', async () => {
    const baseline = new Map();
    runProcess.mockResolvedValue({
      code: -1,
      stdout: '',
      stderr: '',
      timedOut: true,
    });
    const result = await diffTypeCheckErrors(baseline);
    expect(result.ok).toBe(false);
    expect(result.newErrors).toEqual(['type-check timed out']);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { killActiveChildren, runProcess } from './proc.mjs';

describe('runProcess — basic execution', () => {
  it('captures stdout and a zero exit code on success', async () => {
    const result = await runProcess('node', [
      '-e',
      "process.stdout.write('hello')",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('captures a non-zero exit code', async () => {
    const result = await runProcess('node', ['-e', 'process.exit(3)']);
    expect(result.code).toBe(3);
  });

  it('captures stderr separately from stdout', async () => {
    const result = await runProcess('node', [
      '-e',
      "process.stdout.write('out'); process.stderr.write('err')",
    ]);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
  });
});

describe('runProcess — timeout handling', () => {
  it('kills a hung process at the timeout and reports timedOut:true', async () => {
    const start = Date.now();
    const result = await runProcess(
      'node',
      ['-e', 'setTimeout(() => {}, 30000)'],
      {
        timeoutMs: 800,
      }
    );
    const elapsed = Date.now() - start;
    expect(result.timedOut).toBe(true);
    // generous upper bound — proves tree-kill actually terminated the process
    // instead of the promise hanging until the real 30s timer fired
    expect(elapsed).toBeLessThan(10_000);
  }, 15_000);

  it('does not report timedOut for a process that finishes well within the timeout', async () => {
    const result = await runProcess(
      'node',
      ['-e', "process.stdout.write('fast')"],
      {
        timeoutMs: 5000,
      }
    );
    expect(result.timedOut).toBe(false);
  });
});

describe('runProcess — output truncation', () => {
  it('keeps only the tail of output that exceeds maxOutputChars', async () => {
    const script =
      "for (let i = 0; i < 500; i++) { process.stdout.write('line' + i + '\\n'); }";
    const result = await runProcess('node', ['-e', script], {
      maxOutputChars: 200,
    });
    expect(result.stdout.length).toBeLessThanOrEqual(200);
    expect(result.stdout).toContain('line499');
    expect(result.stdout).not.toContain('line0\n');
  });

  it('does not truncate output smaller than maxOutputChars', async () => {
    const result = await runProcess(
      'node',
      ['-e', "process.stdout.write('short')"],
      {
        maxOutputChars: 10_000,
      }
    );
    expect(result.stdout).toBe('short');
  });
});

describe('runProcess — environment filtering', () => {
  const isWindows = process.platform === 'win32';

  it('strips secret-shaped env vars from the child process', async () => {
    process.env.GEMINI_API_KEY = 'leak-test-key';
    process.env.SOME_RANDOM_TOKEN = 'leak-test-token';
    process.env.MY_APP_SECRET = 'leak-test-secret';
    try {
      const script = isWindows
        ? 'echo %GEMINI_API_KEY%|%SOME_RANDOM_TOKEN%|%MY_APP_SECRET%'
        : 'echo $GEMINI_API_KEY|$SOME_RANDOM_TOKEN|$MY_APP_SECRET';
      const result = isWindows
        ? await runProcess('cmd', ['/c', script])
        : await runProcess('sh', ['-c', script]);
      expect(result.stdout).not.toContain('leak-test-key');
      expect(result.stdout).not.toContain('leak-test-token');
      expect(result.stdout).not.toContain('leak-test-secret');
    } finally {
      delete process.env.GEMINI_API_KEY;
      delete process.env.SOME_RANDOM_TOKEN;
      delete process.env.MY_APP_SECRET;
    }
  });

  it('passes through non-sensitive env vars', async () => {
    process.env.NOT_SENSITIVE_MARKER = 'should-survive-123';
    try {
      const script = isWindows
        ? 'echo %NOT_SENSITIVE_MARKER%'
        : 'echo $NOT_SENSITIVE_MARKER';
      const result = isWindows
        ? await runProcess('cmd', ['/c', script])
        : await runProcess('sh', ['-c', script]);
      expect(result.stdout).toContain('should-survive-123');
    } finally {
      delete process.env.NOT_SENSITIVE_MARKER;
    }
  });

  it('always sets CI=true regardless of the parent environment', async () => {
    const script = isWindows ? 'echo %CI%' : 'echo $CI';
    const result = isWindows
      ? await runProcess('cmd', ['/c', script])
      : await runProcess('sh', ['-c', script]);
    expect(result.stdout.trim()).toBe('true');
  });
});

describe('killActiveChildren', () => {
  it('does not throw when there are no active children', () => {
    expect(() => killActiveChildren()).not.toThrow();
  });
});

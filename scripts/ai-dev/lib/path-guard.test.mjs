// @vitest-environment node
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { guardPath, normalizePath, PathGuardError } from './path-guard.mjs';

describe('normalizePath', () => {
  it('converts Windows backslashes to forward slashes', () => {
    expect(normalizePath('src\\components\\Foo.tsx')).toBe(
      'src/components/Foo.tsx'
    );
  });

  it('leaves POSIX paths untouched', () => {
    expect(normalizePath('src/components/Foo.tsx')).toBe(
      'src/components/Foo.tsx'
    );
  });
});

describe('guardPath — legal paths', () => {
  it('resolves an ordinary nested source path', () => {
    const { relativePath, absolutePath } = guardPath('src/components/Foo.tsx');
    expect(relativePath).toBe('src/components/Foo.tsx');
    expect(absolutePath.endsWith('Foo.tsx')).toBe(true);
  });

  it('accepts a Windows-style backslash path and normalizes the return value', () => {
    const { relativePath } = guardPath('src\\components\\Foo.tsx');
    expect(relativePath).toBe('src/components/Foo.tsx');
  });

  it('resolves "." to the repo root with an empty relative path', () => {
    const { relativePath } = guardPath('.');
    expect(relativePath).toBe('');
  });
});

describe('guardPath — rejects invalid input', () => {
  it('rejects an empty string', () => {
    expect(() => guardPath('')).toThrow(PathGuardError);
  });

  it('rejects a non-string path', () => {
    expect(() => guardPath(42)).toThrow(PathGuardError);
    expect(() => guardPath(null)).toThrow(PathGuardError);
    expect(() => guardPath(undefined)).toThrow(PathGuardError);
  });
});

describe('guardPath — directory traversal', () => {
  it('rejects a relative path that escapes the repo root', () => {
    expect(() => guardPath('../../../../../../../../etc/passwd')).toThrow(
      PathGuardError
    );
  });

  it('rejects an absolute path outside the repo root', () => {
    expect(() => guardPath(join(tmpdir(), 'evil.txt'))).toThrow(PathGuardError);
  });

  it('rejects a path that traverses out and back in but still resolves outside root', () => {
    expect(() => guardPath('../../../etc/../../../passwd')).toThrow(
      PathGuardError
    );
  });
});

describe('guardPath — blocked exact files', () => {
  it.each([
    'package.json',
    'tsconfig.json',
    'next.config.js',
    '.npmrc',
    '.eslintrc.json',
    'vitest.config.mts',
    'playwright.config.ts',
    'tailwind.config.js',
    '.prettierrc',
  ])('blocks %s at the repo root', (path) => {
    expect(() => guardPath(path)).toThrow(PathGuardError);
  });

  it('is case-insensitive for blocked exact files (Windows/macOS filesystems)', () => {
    expect(() => guardPath('Package.json')).toThrow(PathGuardError);
    expect(() => guardPath('PACKAGE.JSON')).toThrow(PathGuardError);
    expect(() => guardPath('TsConfig.json')).toThrow(PathGuardError);
  });
});

describe('guardPath — blocked prefixes', () => {
  it.each([
    '.git/hooks/pre-commit',
    'node_modules/some-package/index.js',
    '.env',
    '.env.local',
    '.env.development.local',
    '.github/workflows/ci.yml',
    '.husky/pre-commit',
    'pnpm-lock.yaml',
  ])('blocks paths under %s', (path) => {
    expect(() => guardPath(path)).toThrow(PathGuardError);
  });

  it('is case-insensitive for blocked prefixes', () => {
    expect(() => guardPath('.GIT/hooks/pre-commit')).toThrow(PathGuardError);
    expect(() => guardPath('.Env.Local')).toThrow(PathGuardError);
    expect(() => guardPath('NODE_MODULES/foo/index.js')).toThrow(
      PathGuardError
    );
  });
});

describe('guardPath — refuses to let the agent modify its own implementation', () => {
  it.each([
    'scripts/ai-dev/lib/path-guard.mjs',
    'scripts/ai-dev/lib/gemini-agent.mjs',
    'scripts/ai-dev/orchestrator.mjs',
    'scripts/ai-dev/README.md',
  ])(
    'blocks %s — an agent must never be able to weaken its own sandbox',
    (path) => {
      expect(() => guardPath(path)).toThrow(PathGuardError);
    }
  );

  it('does not block an unrelated scripts/ directory', () => {
    expect(() => guardPath('scripts/generate-types.mjs')).not.toThrow();
  });
});

describe('guardPath — .env.example allowlist exception', () => {
  it('allows .env.example even though it matches the .env prefix block', () => {
    const { relativePath } = guardPath('.env.example');
    expect(relativePath).toBe('.env.example');
  });

  it('is case-insensitive for the .env.example exception', () => {
    const { relativePath } = guardPath('.ENV.EXAMPLE');
    expect(relativePath.toLowerCase()).toBe('.env.example');
  });

  it('blocks a file that merely starts with ".env.example" but is not exactly it', () => {
    expect(() => guardPath('.env.example.local')).toThrow(PathGuardError);
  });
});

describe('guardPath — blocked basenames at any directory depth', () => {
  it.each([
    'src/.eslintrc.js',
    'src/components/.eslintrc.cjs',
    'src/components/nested/deep/eslint.config.mjs',
    'src/.prettierrc.js',
    'deeply/nested/dir/prettier.config.js',
  ])(
    'blocks %s even though only the root-level file is in BLOCKED_EXACT',
    (path) => {
      expect(() => guardPath(path)).toThrow(PathGuardError);
    }
  );

  it('does not block an unrelated file that merely lives near a blocked basename', () => {
    expect(() => guardPath('src/components/eslint-helper.ts')).not.toThrow();
  });
});
